#!/usr/bin/perl
use strict;
use warnings;
use JSON::PP qw(decode_json);
use File::Basename qw(basename);
use File::Path qw(make_path);
use File::Temp qw(tempdir);
use FindBin;
use Cwd qw(abs_path);

# macOS native sips; no downloads, image generation, or game/database writes.
# Outputs are staged for review, not installed into images/ by default.
die "Usage: perl split-composite.pl COMPOSITE [NEW_OUTPUT_DIRECTORY]\n"
    unless @ARGV >= 1 && @ARGV <= 2;
my ($input, $output) = @ARGV;
$input = abs_path($input) or die "Composite not found\n";
die "Composite must be a regular file\n" unless -f $input;
die "Requires macOS /usr/bin/sips\n" unless -x '/usr/bin/sips';
$output //= "$FindBin::Bin/paintings";
open my $mf, '<:raw', "$FindBin::Bin/manifest.json" or die $!;
my $manifest = decode_json(do { local $/; <$mf> });
close $mf;
die "Manifest must describe a 5x2 grid of 2:3 panels\n"
    unless $manifest->{columns} == 5 && $manifest->{rows} == 2
    && $manifest->{panel_aspect_ratio} eq '2:3'
    && @{$manifest->{panels}} == 10;

sub capture {
    open my $pipe, '-|', @_ or die "Cannot run sips: $!\n";
    my $text = do { local $/; <$pipe> };
    close $pipe or die "sips failed\n";
    return $text;
}
sub dimensions {
    my ($path) = @_;
    my $info = capture('/usr/bin/sips', '-g', 'pixelWidth', '-g', 'pixelHeight', $path);
    my ($w) = $info =~ /pixelWidth:\s*(\d+)/;
    my ($h) = $info =~ /pixelHeight:\s*(\d+)/;
    die "Cannot read image dimensions\n" unless $w && $h;
    return ($w, $h);
}
my ($width, $height) = dimensions($input);
my (@xs, @ys, $pw, $ph);
my $layout = $manifest->{crop_layout};
if ($layout && $layout->{source_pixels}[0] == $width && $layout->{source_pixels}[1] == $height) {
    @xs = @{$layout->{column_edges}};
    @ys = @{$layout->{row_edges}};
    my $inset = $layout->{seam_inset_pixels} // 0;
    die "Invalid crop layout\n" unless @xs == 6 && @ys == 3
        && $xs[0] == 0 && $xs[-1] == $width && $ys[0] == 0 && $ys[-1] == $height
        && $inset =~ /^\d+$/;
    my $scale = $width;
    for my $c (0..4) {
        die "Invalid column edges\n" unless $xs[$c+1] > $xs[$c];
        my $fit = int(($xs[$c+1] - $xs[$c] - 2 * $inset) / 2);
        $scale = $fit if $fit < $scale;
    }
    for my $r (0..1) {
        die "Invalid row edges\n" unless $ys[$r+1] > $ys[$r];
        my $fit = int(($ys[$r+1] - $ys[$r] - 2 * $inset) / 3);
        $scale = $fit if $fit < $scale;
    }
    die "Crop layout too small\n" unless $scale > 0;
    ($pw, $ph) = (2 * $scale, 3 * $scale);
    print "Using observed manifest boundaries with centered ${pw}x${ph} crops; no resizing.\n";
} else {
    die "Composite must divide exactly into 5 columns and 2 rows; got ${width}x${height}\n"
        if $width % 5 || $height % 2;
    ($pw, $ph) = ($width / 5, $height / 2);
    die "Each panel must have exact portrait 2:3 proportions; got ${pw}x${ph}\n"
        unless $pw * 3 == $ph * 2;
    @xs = map { $_ * $pw } 0..5;
    @ys = map { $_ * $ph } 0..2;
}
my %seen;
my @names;
for my $i (0..9) {
    my $p = $manifest->{panels}[$i];
    die "Invalid manifest position or filename\n"
        unless $p->{position} == $i + 1 && $p->{row} == int($i / 5) + 1
        && $p->{column} == $i % 5 + 1
        && $p->{expected_filename} eq "images/pdd$p->{pdd}.jpg";
    my $name = basename($p->{expected_filename});
    die "Duplicate filename\n" if $seen{$name}++;
    # -l catches dangling symlinks as well as existing files/directories.
    die "Refusing to overwrite $output/$name\n" if -e "$output/$name" || -l "$output/$name";
    push @names, $name;
}
make_path($output) unless -d $output;
$output = abs_path($output) or die "Cannot resolve output directory\n";
my $stage = tempdir('.split-staging-XXXXXX', DIR => $output, CLEANUP => 1);
# Decode once with sips, then crop pixel rows explicitly. This avoids sips'
# inconsistent cropOffset behaviour at the lower grid boundary.
my $decoded = "$stage/composite.bmp";
capture('/usr/bin/sips', '-s', 'format', 'bmp', $input, '--out', $decoded);
open my $bf, '<:raw', $decoded or die $!;
my $bitmap = do { local $/; <$bf> };
close $bf;
die "Unsupported BMP decoder output\n" unless substr($bitmap, 0, 2) eq 'BM';
my $pixels = unpack('V', substr($bitmap, 10, 4));
my ($bw, $bh) = unpack('l<l<', substr($bitmap, 18, 8));
my $bits = unpack('v', substr($bitmap, 28, 2));
my $compression = unpack('V', substr($bitmap, 30, 4));
die "Requires uncompressed 24/32-bit BMP decoder output\n"
    unless ($bits == 24 || $bits == 32) && $compression == 0
    && $bw == $width && abs($bh) == $height;
my $stride = int(($width * $bits + 31) / 32) * 4;
die "Truncated decoded bitmap\n" if length($bitmap) < $pixels + $stride * $height;
my $crop_stride = int(($pw * 24 + 31) / 32) * 4;
my $crop_bytes = $crop_stride * $ph;
for my $i (0..9) {
    my $column = $i % 5;
    my $grid_row = int($i / 5);
    my $x = $xs[$column] + int(($xs[$column+1] - $xs[$column] - $pw) / 2);
    my $y = $ys[$grid_row] + int(($ys[$grid_row+1] - $ys[$grid_row] - $ph) / 2);
    my $dest = "$stage/$names[$i]";
    my $crop = "$stage/crop-$i.bmp";
    open my $cf, '>:raw', $crop or die $!;
    print $cf pack('a2VvvV', 'BM', 54 + $crop_bytes, 0, 0, 54);
    print $cf pack('V3v2V6', 40, $pw, $ph, 1, 24, 0, $crop_bytes, 2835, 2835, 0, 0);
    for my $row (reverse 0..$ph-1) {
        my $source_y = $bh > 0 ? $height - 1 - ($y + $row) : $y + $row;
        my $line = substr($bitmap, $pixels + $source_y * $stride + $x * ($bits / 8), $pw * ($bits / 8));
        if ($bits == 32) {
            my $rgb = '';
            $rgb .= substr($line, $_ * 4, 3) for 0..$pw-1;
            $line = $rgb;
        }
        print $cf $line, "\0" x ($crop_stride - length($line));
    }
    close $cf or die $!;
    capture('/usr/bin/sips', '-s', 'format', 'jpeg',
        '-s', 'formatOptions', 'best', $crop, '--out', $dest);
    my ($w, $h) = dimensions($dest);
    die "Unexpected output dimensions for $names[$i]: ${w}x${h}, expected ${pw}x${ph}\n" unless $w == $pw && $h == $ph;
}
for my $i (0..9) {
    # Hard-linking within the same filesystem is atomic and cannot clobber a
    # destination created since preflight. No final files until all crops pass.
    link("$stage/$names[$i]", "$output/$names[$i]")
        or die "Cannot publish $names[$i] without overwrite: $!\n";
}
print "Saved ten ${pw}x${ph} portrait JPGs to $output\n";
print "$_\n" for @names;
