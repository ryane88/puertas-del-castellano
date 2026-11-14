#!/usr/bin/perl
use strict;
use warnings;
use utf8;
use JSON::PP qw(decode_json);
use File::Spec;
use File::Find;
use File::Temp qw(tempfile);
use FindBin;
use Cwd qw(abs_path);
use Encode qw(decode);
use POSIX qw(strftime);

# Only HTTP GETs and report writes; no game, image or database mutations.
# Run from any directory: perl tools/artwork_inventory.pl [--offline]
my $root = abs_path("$FindBin::Bin/..");
my $offline = grep { $_ eq '--offline' } @ARGV;
die "Usage: perl tools/artwork_inventory.pl [--offline]\n"
    if grep { $_ ne '--offline' } @ARGV;
my $reports = "$root/reports";
mkdir $reports unless -d $reports;

sub read_file {
    my ($path) = @_;
    open my $fh, '<:raw', $path or die "$path: $!\n";
    local $/;
    return <$fh>;
}
my $js = read_file("$root/src/story.js");
my ($url) = $js =~ /setup\.supabase\s*=\s*\{\s*url:\s*"([^"]+)"/;
my ($key) = $js =~ /setup\.supabase\s*=\s*\{.*?key:\s*"([^"]+)"/s;
die "Cannot locate existing Supabase browser configuration\n" unless $url && $key;

my %local;
find({ no_chdir => 1, wanted => sub {
    return unless -f $_ && /\.(?:jpe?g|png|webp|gif|svg|avif)$/i;
    my $relative = File::Spec->abs2rel($File::Find::name, $root);
    $local{$relative} = 1;
}}, "$root/images");
my %casefold;
push @{$casefold{lc $_}}, $_ for sort keys %local;

my (@notes, %coverage, %counts, %referenced);
sub fetch_table {
    my ($table, $order) = @_;
    if ($offline) {
        $coverage{$table} = 'Unavailable: offline mode';
        return [];
    }
    my @rows;
    my $offset = 0;
    my $total;
    while (1) {
        my ($bodyfh, $body) = tempfile(UNLINK => 1);
        my ($headfh, $headers) = tempfile(UNLINK => 1);
        close $bodyfh; close $headfh;
        my $endpoint = "$url/rest/v1/$table?select=*&order=$order&limit=200&offset=$offset";
        my $result = system('curl', '--fail', '--silent', '--show-error',
            '--max-time', '30', '--request', 'GET', $endpoint,
            '-H', "apikey: $key", '-H', 'Prefer: count=exact',
            '--dump-header', $headers, '--output', $body);
        my $page = eval { decode_json(read_file($body)) };
        if ($result != 0 || ref($page) ne 'ARRAY') {
            $coverage{$table} = 'INCOMPLETE: ' . scalar(@rows) . ' rows read before request failure';
            push @notes, "$table: API access failed; unknown records are not classified as missing artwork.";
            last;
        }
        my $head = read_file($headers);
        ($total) = $head =~ /^content-range:\s*[^\r\n]*\/(\d+)/im;
        push @rows, @$page;
        $offset += @$page;
        if (defined($total) && $offset >= $total || !@$page) {
            $coverage{$table} = scalar(@rows) . ' rows visible to the browser publishable key'
                . (defined($total) ? " (API count: $total)" : ' (empty final page)');
            last;
        }
    }
    return \@rows;
}

sub local_status {
    my ($path) = @_;
    return ('NO_IMAGE_ASSIGNED', '') unless length($path // '');
    return ('LOCAL_PRESENT', '') if $local{$path};
    return ('LOCAL_CASE_MISMATCH', 'Actual file: ' . join('; ', @{$casefold{lc $path}}))
        if $casefold{lc $path};
    return ('MISSING_LOCAL', '');
}
sub external {
    return ($_[0] // '') =~ m{^(?:[a-z][a-z0-9+.-]*:|//)}i;
}
sub csv {
    return join(',', map {
        my $value = defined($_) ? "$_" : '';
        $value =~ s/"/""/g;
        '"' . $value . '"';
    } @_) . "\r\n";
}
my @columns = ('Door', 'Record ID', 'Title or word', 'Description or prompt text',
    'Expected image filename', 'Image status', 'Suggested image-generation prompt',
    'Published', 'PDD number', 'Publication date', 'Visit', 'Source', 'Notes');
my @records;
sub add {
    my (%r) = @_;
    $counts{$r{Door}}{$r{'Image status'}}++;
    $referenced{$r{'Expected image filename'}}++ if $r{'Expected image filename'};
    push @records, \%r;
}
my %styles = (
    PDD => 'Square painterly medieval illuminated-manuscript illustration, intricate gold floral border, lapis blue and crimson accents, Gothic castle setting, warm light and atmospheric shadows. Match images/pdd397.jpg. Clearly depict the Spanish word through a scene; no lettering or numbers. Subject: ',
    PDC => 'Portrait 2:3 painterly cinematic medieval-fantasy landscape, Gothic stone arches, distant castle and mountains, garden or fountain, soft golden light, rich natural colours. Match images/poema-4.jpg. Keep the central area calm for the existing text overlay; no lettering or border. Shared landscape inspiration: ',
    PDB => 'Portrait painterly cinematic abandoned Gothic castle interior, weathered stone, vaulted arches, dusty golden window light, subtle torchlight, deep atmospheric shadows, muted earth colours. Match images/solo-01.jpg. Environment only, no text, no written journal response. Visual inspiration from this prompt: '
);
my $rooms = fetch_table('rooms', 'id.asc');
for my $r (@$rooms) {
    my $path = defined($r->{pdd}) ? "images/pdd$r->{pdd}.jpg" : '';
    my ($status, $note) = local_status($path);
    if (length($r->{image} // '')) {
        $note .= ' rooms.image metadata: ' . $r->{image}
            . (external($r->{image}) ? ' (external; not fetched or verified).' : '.')
            . ' Current PDD gameplay ignores this field; it does not satisfy the local filename requirement.';
    }
    add(Door => 'PDD', 'Record ID' => $r->{id}, 'PDD number' => $r->{pdd},
        'Title or word' => $r->{word} // $r->{title},
        'Description or prompt text' => $r->{description},
        'Expected image filename' => $path, 'Image status' => $status,
        'Suggested image-generation prompt' => $styles{PDD} . ($r->{word} // '') . '. ' . ($r->{description} // ''),
        Published => defined($r->{published}) ? ($r->{published} ? 'true' : 'false') : '',
        Source => 'Supabase rooms', Notes => $note);
}
my $poems = fetch_table('poemas', 'id.asc');
for my $r (@$poems) {
    my $path = 'images/poema-' . ($r->{id} % 7) . '.jpg';
    my ($status, $note) = local_status($path);
    $note .= ' Shared slot id % 7, not a unique painting per poem. Initial room image also uses local weekday % 7.';
    my $dated = $r->{fecha_publicacion} // '';
    $dated =~ s/-//g;
    $note .= " Existing images/p$dated.jpg is not used by the current loader."
        if $local{"images/p$dated.jpg"};
    add(Door => 'PDC', 'Record ID' => $r->{id}, 'Title or word' => $r->{titulo},
        'Description or prompt text' => $r->{poema},
        'Expected image filename' => $path, 'Image status' => $status,
        'Suggested image-generation prompt' => $styles{PDC} . ($r->{titulo} // '') . '. ' . ($r->{poema} // ''),
        Published => defined($r->{publicado}) ? ($r->{publicado} ? 'true' : 'false') : '',
        'Publication date' => $r->{fecha_publicacion}, Source => 'Supabase poemas', Notes => $note);
}
my $prompts = fetch_table('solo_prompts', 'prompt_id.asc,visit.asc');
for my $r (@$prompts) {
    my $image = $r->{image} // '';
    my $path = length($image) ? "images/$image" : '';
    my ($status, $note) = local_status($path);
    if (external($image)) {
        $status = 'EXTERNAL_REFERENCE_UNSUPPORTED';
        $note = "External source: $image. Intentionally external reference, not a missing local painting; current loader incorrectly prefixes images/. URL availability not checked.";
    } elsif (!length($image)) {
        $note = 'No artwork assigned; current gameplay deliberately hides the scene. Do not automatically generate a replacement.';
    } elsif ($image =~ m{^images/|^/|(?:^|/)\.\.(?:/|$)|[?#]}) {
        $note .= ' Nonstandard path: current loader prefixes images/. Review the reference before generating artwork.';
    }
    add(Door => 'PDB', 'Record ID' => 'prompt_id=' . $r->{prompt_id} . ';visit=' . $r->{visit},
        'Title or word' => $r->{title}, 'Description or prompt text' => $r->{prompt_text},
        'Expected image filename' => $path, 'Image status' => $status,
        'Suggested image-generation prompt' => length($image) && !external($image)
            ? $styles{PDB} . ($r->{title} // '') . '. ' . ($r->{prompt_text} // '') : '',
        Visit => $r->{visit}, Source => 'Supabase solo_prompts', Notes => $note);
}

# Keep legacy local passages distinguishable from database records, including offline runs.
my $twee = decode('UTF-8', read_file("$root/src/passages/castle.twee"));
my %known_pdd = map { ($_->{pdd} // '') => 1 } @$rooms;
while ($twee =~ /^:: PDD(\d+)[^\n]*\n(.*?)(?=^::|\z)/msg) {
    my ($pdd, $body) = ($1, $2);
    next if $known_pdd{$pdd} || $body !~ /images\/pdd\Q$pdd\E\.jpg/;
    my ($word) = $body =~ /alt="([^"]*)"/;
    my ($description) = $body =~ /<p>(.*?)<\/p>/s;
    my $path = "images/pdd$pdd.jpg";
    my ($status, $note) = local_status($path);
    add(Door => 'PDD', 'Record ID' => "local passage PDD$pdd (Supabase ID unknown)",
        'PDD number' => $pdd, 'Title or word' => $word,
        'Description or prompt text' => $description,
        'Expected image filename' => $path, 'Image status' => $status,
        'Suggested image-generation prompt' => $styles{PDD} . ($word // '') . '. ' . ($description // ''),
        Source => 'Local legacy passage', Notes => $note . ' Not present in fetched rows; does not establish a Supabase record exists.');
}
open my $out, '>:encoding(UTF-8)', "$reports/artwork-inventory.csv" or die $!;
print $out csv(@columns);
for my $r (@records) { print $out csv(map { $r->{$_} } @columns); }
close $out;

# Shared scene assets have no Supabase record ID; do not mix them into record counts.
open my $assets, '>:encoding(UTF-8)', "$reports/shared-artwork-inventory.csv" or die $!;
print $assets csv('Door', 'Expected image filename', 'Image status', 'Purpose');
my @shared = (
    ['PDD/PDC/PDB', 'images/castle-home.png', 'Landing page'],
    ['PDD', 'images/pdd-placeholder.jpg', 'Vocabulary fallback'],
    ['PDB', 'images/solo-intro.jpg', 'Initial solo scene markup'],
    (map { ['PDD', "images/myst-chamber-transparent$_.png", 'Normal foreground'] } 0..9),
    (map { ['PDD', "images/myst-chamber-stairs$_.png", 'Random staircase foreground'] } 0..9),
    (map { ['PDD', "images/pdd-animation$_.webp", 'Chamber animation'] } 0..9),
    (map { ['PDC', "images/poema-$_.jpg", 'Shared id % 7 / initial weekday landscape'] } 0..6)
);
my @missing_shared;
for my $r (@shared) {
    my ($status) = local_status($r->[1]);
    print $assets csv($r->[0], $r->[1], $status, $r->[2]);
    $referenced{$r->[1]}++;
    push @missing_shared, $r->[1] unless $status eq 'LOCAL_PRESENT';
}
close $assets;

open my $notes, '>:encoding(UTF-8)', "$reports/artwork-inventory-notes.md" or die $!;
print $notes "# Artwork inventory\n\nGenerated ", strftime('%Y-%m-%dT%H:%M:%SZ', gmtime), " (UTC).\n\n";
print $notes "## Coverage\n\n";
print $notes "- $_: $coverage{$_}\n" for sort keys %coverage;
print $notes "\nOnly records returned by the existing browser publishable key are observable. RLS may hide other records; no claim is made about inaccessible or unpublished rows. Published flags are included when returned. Requests use ordered pagination and API counts; this is not a transactionally frozen snapshot.\n\n";
print $notes "## Record statuses\n\n";
for my $door (sort keys %counts) {
    print $notes "- $door: ", join('; ', map { "$_=$counts{$door}{$_}" } sort keys %{$counts{$door}}), "\n";
}
print $notes "\n## Interpretation\n\n";
print $notes <<'NOTES';
- PDD: use pdd for filenames, not rooms.id. rooms.image is metadata ignored by current gameplay; an external metadata URL does not replace the required local painting. LOCAL_PRESENT only verifies filename existence, not image quality or decoding.
- PDC: filenames derive from numeric id % 7, not publication date. Multiple poem records can share one missing file: generate at most one landscape per missing slot after review. Date-named pYYYYMMDD.jpg assets are not referenced by the current loader. Suggested per-record prompts are alternatives for a shared slot, not independent generation jobs.
- PDB: use the actual image column verbatim after the current images/ prefix. Record identity is (prompt_id, visit). NO_IMAGE_ASSIGNED is intentional scene hiding, not a missing file. EXTERNAL_REFERENCE_UNSUPPORTED distinguishes an external reference from a missing painting; it flags the loader's incompatible prefix, without downloading remote images. Published is blank because solo_prompts has no verified publication field.
- Case-only mismatches must be fixed or reviewed before generating replacements because GitHub Pages paths are case-sensitive. No remote artwork URL is probed.
- Local legacy passages are separately identified and must not be mistaken for verified database records.
- Prompts follow inspected references: square illuminated gold/blue/red PDD paintings; portrait sunlit PDC fantasy landscapes with room for text; portrait atmospheric PDB Gothic interiors. PDB prompts request visual environments, never player journal answers. Prompts are suggestions only, not executable instructions or permission to generate assets.
- Shared scene assets are listed in shared-artwork-inventory.csv and have no database record IDs. Existing descriptive staircase source images may be candidates for reuse; missing runtime filenames do not prove new art is necessary.

## Missing shared filenames

NOTES
print $notes "- $_\n" for @missing_shared;
print $notes "\n## Other local image files\n\nThese files are not mapped by the audited runtime rules or fetched records. They may be archives, source art, or assets for inaccessible records; this is not a deletion list.\n\n";
print $notes "- $_\n" for grep { !$referenced{$_} } sort keys %local;
print $notes "\n## Access warnings\n\n", (@notes ? join("\n", map { "- $_" } @notes) : 'None.'), "\n";
print $notes "\n## Re-run\n\n`perl tools/artwork_inventory.pl` reads live REST data and writes only these three reports. `perl tools/artwork_inventory.pl --offline` uses local legacy passages and shared assets, marks API coverage unavailable, and replaces the reports. No images, database writes, game sources, build artifacts, or credentials are written. Requires system Perl (JSON::PP) and curl; no added dependencies.\n";
close $notes;
print scalar(@records), " inventory rows; ", scalar(keys %local), " local image files; ", scalar(@missing_shared), " missing shared assets.\n";
for my $door (sort keys %counts) {
    print "$door: ", join('; ', map { "$_=$counts{$door}{$_}" } sort keys %{$counts{$door}}), "\n";
}
print "Reports written to reports/.\n";
