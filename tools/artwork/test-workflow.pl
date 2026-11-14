#!/usr/bin/perl
use strict;
use warnings;
use JSON::PP qw(decode_json);
use File::Temp qw(tempdir);
use File::Path qw(make_path);
use File::Copy qw(copy);
use FindBin;
use Cwd qw(abs_path getcwd);
use Digest::SHA qw(sha256_hex);
use Test::More;
my $project=abs_path("$FindBin::Bin/../..");
my $fixture=tempdir('pdc-workflow-XXXXXX',TMPDIR=>1,CLEANUP=>1);
make_path(map {"$fixture/$_"} qw(tools/artwork reports/pdd-batch-01 images src mockbin));
sub raw {open my $f,'<:raw',$_[0] or die $!;local $/;<$f>}
sub write_file {open my $f,'>:raw',$_[0] or die $!;print $f $_[1];close $f or die $!;}
sub put {write_file($_[0],JSON::PP->new->canonical->pretty->utf8->encode($_[1]))}
sub get {decode_json(raw($_[0]))}
copy("$project/tools/artwork_batch.pl","$fixture/tools/artwork_batch.pl") or die $!;
for(qw(split-composite.pl prompt-header.txt)){copy("$project/tools/artwork/$_","$fixture/tools/artwork/$_") or die $!;}
write_file("$fixture/src/story.js",'setup.supabase = {url: "https://fixture.invalid", key: "test-publishable"};');
my @rooms=map {{id=>100+$_,pdd=>$_,word=>"Palabra $_",short_definition=>"Meaning $_",description=>"A medieval castle story for word $_."}}1..55;
put("$fixture/fixture-rooms.json",\@rooms);
put("$fixture/reports/pdd-batch-01/manifest.json",{panels=>[map {{pdd=>$_,supabase_record_id=>100+$_}}1..10]});
write_file("$fixture/images/pdd11.jpg",'existing production fixture');
write_file("$fixture/tools/artwork_inventory.pl",<<'INVENTORY');
use strict;use warnings;use JSON::PP qw(decode_json);
open my $r,'<:raw','fixture-rooms.json' or die $!;my $rows=decode_json(do{local $/;<$r>});
open my $f,'>','reports/artwork-inventory.csv' or die $!;
print $f "Door,Record ID,PDD number,Expected image filename,Image status,Source\r\n";
for(@$rows){print $f "PDD,$_->{id},$_->{pdd},images/pdd$_->{pdd}.jpg,MISSING_LOCAL,Supabase rooms\r\n";}
open my $n,'>','reports/artwork-inventory-notes.md' or die $!;
print $n -e 'fixture-incomplete' ? '- rooms: INCOMPLETE' : '- rooms: 55 rows visible to browser key (API count: 55)';
INVENTORY
write_file("$fixture/mockbin/curl",<<'CURL');
#!/usr/bin/perl
use strict;use warnings;use JSON::PP qw(decode_json encode_json);
exit 22 if -e 'fixture-network-fail';
my($url)=grep {/rest\/v1\/rooms/}@ARGV;die 'Unexpected request' unless $url&&$url=~/pdd=in\.\(([\d,]+)\)/;
my %want=map {$_=>1}split /,/,$1;
open my $f,'<:raw','fixture-rooms.json' or die $!;my $all=decode_json(do{local $/;<$f>});
print encode_json([grep {$want{$_->{pdd}}}@$all]);
CURL
chmod 0755,"$fixture/mockbin/curl";
local $ENV{PATH}="$fixture/mockbin:$ENV{PATH}";
chdir $fixture or die $!;
my $calls=0;
sub run {
    my(@args)=@_;$calls++;
    my $log="$fixture/log-$calls.txt";
    my $pid=fork();die $! unless defined $pid;
    if(!$pid){open STDOUT,'>',$log or die $!;open STDERR,'>&',\*STDOUT or die $!;exec $^X,'tools/artwork_batch.pl',@args;die $!;}
    waitpid($pid,0);my $status=$?>>8;
    return ($status,raw($log));
}
sub passes {my($label,@args)=@_;my($s,$log)=run(@args);is($s,0,$label)or diag $log;}
sub fails {my($label,@args)=@_;my($s,$log)=run(@args);isnt($s,0,$label);}
fails('reject one-digit batch','6','prepare');
fails('reject path traversal','../06','prepare');
passes('prepare from fixture only','06','prepare');
my $base='reports/pdd-batch-06';my $m=get("$base/manifest.json");
is_deeply([map {$_->{pdd}}@{$m->{panels}}],[12..21],'exclude earlier assigned PDDs and existing artwork');
my $frozen=raw("$base/manifest.json");
passes('rerun preparation keeps frozen selection','06','prepare');
is(raw("$base/manifest.json"),$frozen,'manifest unchanged on rerun');
fails('completion forbidden before images','06','complete');
fails('generation forbidden without final prompt','06','begin-generation');
put("$base/scenes.json",[map {{position=>$_+1,pdd=>12+$_,scene=>'A distinct medieval painterly fixture scene with a traveller, warm torchlight, Gothic stonework and cool blue shadows.'}}0..9]);
passes('construct final prompt from matching scenes','06','plan');
passes('identical plan resume','06','plan');
passes('claim one generation stage without generating','06','begin-generation');
fails('second generation claim refused','06','begin-generation');
passes('in-progress state is inspectable','06','status');
is(get("$base/state.json")->{phase},'generating','interrupted generation not complete');
# Synthetic 100x60 grid: ten grayscale panels. Not AI artwork and no paid call.
open my $bmp,'>:raw',"$fixture/synthetic.bmp" or die $!;
print $bmp pack('a2VvvV','BM',18054,0,0,54),pack('V3v2V6',40,100,60,1,24,0,18000,2835,2835,0,0);
for my $y(0..59){for my $x(0..99){my $i=int((59-$y)/30)*5+int($x/20);print $bmp chr(20+$i*20)x3;}}close $bmp;
system('/usr/bin/sips','-s','format','png',"$fixture/synthetic.bmp",'--out',"$fixture/synthetic.png")==0 or die 'fixture conversion';
passes('adopt real PNG fixture via exclusive copy','06','save-composite',"$fixture/synthetic.png");
passes('adoption rerun with identical source','06','save-composite',"$fixture/synthetic.png");
passes('split fixture through reused script','06','split');
passes('validate ten output crops and build contact sheet','06','validate');
is(get("$base/state.json")->{phase},'validated_awaiting_visual_review','validation alone is not complete');
fails('missing visual review blocks completion','06','complete');
ok(-f "$base/gallery.html",'contact sheet exists');
my $v=get("$base/validation.json");
is_deeply([map {[$_->{width},$_->{height}]}@{$v->{outputs}}],[(map {[20,30]}1..10)],'ten equal portrait 2:3 JPGs');
for my $i(0..9){
    my $jpg="$base/paintings/pdd".(12+$i).'.jpg';my $target="$fixture/check-$i.bmp";
    my $pid=fork();die $! unless defined $pid;
    if(!$pid){open STDOUT,'>','/dev/null';exec '/usr/bin/sips','-s','format','bmp',$jpg,'--out',$target;die $!;}waitpid($pid,0);
    my $b=raw($target);my $offset=unpack('V',substr($b,10,4));my($w,$h)=unpack('l<l<',substr($b,18,8));my $bits=unpack('v',substr($b,28,2));my $stride=int(($w*$bits+31)/32)*4;
    my $sample=ord(substr($b,$offset+15*$stride+10*($bits/8),1));
    cmp_ok(abs($sample-(20+$i*20)),'<=',3,"crop position ".($i+1).' matches synthetic source');
}
# Simulate interrupted final publication, preserving all other files.
unlink "$base/paintings/pdd21.jpg" or die $!;
passes('resume partial publication from exact staged bytes','06','split');
passes('revalidate after resume','06','validate');
my $review={composite_sha256=>$v->{composite_sha256},manifest_sha256=>$v->{manifest_sha256},prompt_sha256=>$v->{prompt_sha256},positions_reviewed=>[1..10],visual_review_passed=>JSON::PP::true,issues=>'Synthetic fixture QC only; no AI generation tested.'};
put("$base/review.json",$review);
passes('complete only with matching visual-QC attestation','06','complete');
passes('completed rerun validates existing outputs','06','status');
is(get("$base/state.json")->{phase},'review_ready','review-ready, not installed');
my $gallery=raw("$base/gallery.html");unlink "$base/gallery.html" or die $!;
fails('missing contact sheet invalidates review-ready status','06','status');
write_file("$base/gallery.html",$gallery);
my $prompt=raw("$base/prompt.md");write_file("$base/prompt.md",$prompt.'changed');
fails('changed prompt invalidates completed status','06','status');
write_file("$base/prompt.md",$prompt);
is_deeply([glob 'images/*'],['images/pdd11.jpg'],'production images untouched');
my $crop=raw("$base/paintings/pdd12.jpg");write_file("$base/paintings/pdd12.jpg",'changed');
fails('changed output invalidates completion status','06','status');
fails('split refuses changed existing review image','06','split');
write_file("$base/paintings/pdd12.jpg",$crop);
write_file('fixture-incomplete','yes');fails('partial API inventory fails closed','07','prepare');unlink 'fixture-incomplete';
write_file('fixture-network-fail','yes');fails('definition fetch failure stays incomplete','07','prepare');unlink 'fixture-network-fail';
passes('retry after preselection request failure','07','prepare');
my $prepared=raw('reports/pdd-batch-07/manifest.json');
unlink 'reports/pdd-batch-07/state.json','reports/pdd-batch-07/README.md','reports/pdd-batch-07/split-composite.pl';
write_file('fixture-network-fail','yes');
passes('managed receipt resumes interrupted metadata publication without reselection','07','prepare');
unlink 'fixture-network-fail';
is(raw('reports/pdd-batch-07/manifest.json'),$prepared,'interrupted preparation preserves original selection');
write_file('reports/pdd-batch-07/manifest.json',raw('reports/pdd-batch-07/manifest.json')." ");
fails('frozen manifest modification rejected','07','status');
passes('new batch for unavailable-generator simulation','08','prepare');
passes('record unavailable generation without substitution','08','blocked','Built-in tool unavailable in fixture');
is(get('reports/pdd-batch-08/state.json')->{phase},'blocked','unavailable generation remains incomplete');
fails('blocked generation cannot be marked complete','08','complete');
fails('historical batch cannot be adopted','01','prepare');
done_testing();
