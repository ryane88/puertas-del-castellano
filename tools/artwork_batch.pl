#!/usr/bin/perl
use strict;
use warnings;
use utf8;
use JSON::PP qw(decode_json);
use Encode qw(decode encode);
use Digest::SHA qw(sha256_hex);
use File::Path qw(make_path);
use File::Temp qw(tempdir tempfile);
use File::Basename qw(basename);
use Fcntl qw(O_CREAT O_EXCL O_WRONLY LOCK_EX LOCK_NB);
use FindBin;
use Cwd qw(abs_path);
use POSIX qw(strftime);
binmode STDOUT, ':encoding(UTF-8)';

my ($batch,$action,@args)=@ARGV;
die "Usage: perl tools/artwork_batch.pl NN prepare|plan|begin-generation|save-composite PATH|blocked REASON|split|validate|complete|status\n"
    unless defined($batch)&&$batch=~/^\d{2}$/&&$batch ne '00'&&defined($action)
    &&$action=~/^(prepare|plan|begin-generation|save-composite|blocked|split|validate|complete|status)$/;
my $root=abs_path("$FindBin::Bin/..");chdir $root or die $!;
my $dir="reports/pdd-batch-$batch";
sub bytes {open my $f,'<:raw',$_[0] or die "$_[0]: $!\n";local $/;<$f>}
sub json {decode_json(bytes($_[0]))}
sub digest {sha256_hex(bytes($_[0]))}
sub exists_any {-e $_[0]||-l $_[0]}
sub exclusive {
    my($file,$body)=@_;die "Refusing symlink $file\n" if -l $file;
    sysopen my $f,$file,O_WRONLY|O_CREAT|O_EXCL,0644 or die "Refusing to overwrite $file: $!\n";
    binmode $f;print $f $body or die $!;close $f or die $!;
}
sub publish_same {
    my($file,$body)=@_;
    if(exists_any($file)){die "Conflicting prepared file $file\n" if -l $file||bytes($file) ne $body}
    else{exclusive($file,$body)}
}
sub json_bytes {JSON::PP->new->canonical->pretty->utf8->encode($_[0])}
sub atomic_json {
    my($file,$data)=@_;die "Refusing symlink $file\n" if -l $file;
    my($f,$temp)=tempfile('.state-XXXXXX',DIR=>$dir,UNLINK=>1);binmode $f;
    print $f json_bytes($data);close $f or die $!;rename $temp,$file or die $!;
}
sub capture {
    open my $f,'-|',@_ or die "Cannot execute $_[0]: $!\n";local $/;my $s=<$f>;
    close $f or die "Command failed: $_[0]\n";return $s;
}
sub image_info {
    my $s=capture('/usr/bin/sips','-g','pixelWidth','-g','pixelHeight','-g','format',$_[0]);
    my($w)=$s=~/pixelWidth:\s*(\d+)/;my($h)=$s=~/pixelHeight:\s*(\d+)/;my($format)=$s=~/format:\s*(\w+)/;
    die "Invalid image $_[0]\n" unless $w&&$h;return ($w,$h,$format);
}
sub csv_rows {
    my $text=decode('UTF-8',bytes($_[0]));my(@rows,@row);my $value='';my $quoted=0;
    for(my $i=0;$i<length($text);$i++){
        my $c=substr($text,$i,1);
        if($c eq '"'){if($quoted&&substr($text,$i+1,1) eq '"'){$value.='"';$i++}else{$quoted=!$quoted}}
        elsif(!$quoted&&$c eq ','){push @row,$value;$value=''}
        elsif(!$quoted&&$c eq "\n"){$value=~s/\r$//;push @row,$value;push @rows,[@row];@row=();$value=''}
        else{$value.=$c}
    }
    die "Malformed CSV\n" if $quoted||@row||length $value;
    my $header=shift @rows;return [map {die 'CSV column count' unless @$_==@$header;my %r;@r{@$header}=@$_;\%r} @rows];
}
sub exclusions {
    my(%p,%id,@paths);
    for my $path(sort glob 'reports/pdd-batch-??/manifest.json'){
        $path=~/pdd-batch-(\d{2})/;next unless $1<$batch;
        die "Earlier manifest is symlink\n" if -l $path;
        my $m=json($path);die "Invalid earlier manifest $path\n" unless ref($m->{panels}) eq 'ARRAY';
        for(@{$m->{panels}}){$p{$_->{pdd}}=1;$id{$_->{supabase_record_id}}=1 if defined $_->{supabase_record_id}}
        push @paths,$path;
    }
    return (\%p,\%id,\@paths);
}
sub validate_manifest {
    my($m)=@_;my($excluded,$ids)=exclusions();my(%p,%id);
    die 'Manifest geometry' unless $m->{columns}==5&&$m->{rows}==2&&$m->{panel_aspect_ratio} eq '2:3'&&@{$m->{panels}}==10;
    opendir my $im,'images' or die $!;my %local=map {lc($_)=>1} readdir $im;closedir $im;
    for my $i(0..9){my $r=$m->{panels}[$i];
        die 'Invalid PDD or ID' unless ($r->{pdd}//'')=~/^[1-9]\d*$/&&($r->{supabase_record_id}//'')=~/^[1-9]\d*$/;
        die 'Repeated/excluded record' if $p{$r->{pdd}}++||$id{$r->{supabase_record_id}}++||$excluded->{$r->{pdd}}||$ids->{$r->{supabase_record_id}};
        die 'Manifest positions/filename' unless $r->{position}==$i+1&&$r->{row}==int($i/5)+1&&$r->{column}==$i%5+1&&$r->{expected_filename} eq "images/pdd$r->{pdd}.jpg";
        die "Production artwork exists for PDD $r->{pdd}; stop for review\n" if $local{lc "pdd$r->{pdd}.jpg"};
        die 'Missing vocabulary source' unless defined($r->{word})&&defined($r->{short_definition})&&defined($r->{description});
    }
}
die "Symlinked reports/batch directory is not allowed\n" if -l 'reports'||-l $dir;
if($action eq 'prepare'){
    system($^X,'tools/artwork_inventory.pl')==0 or die "Inventory refresh failed\n";
    my $coverage=decode('UTF-8',bytes('reports/artwork-inventory-notes.md'));
    die "Inventory rooms coverage incomplete; stop, do not generate\n" unless $coverage=~/^- rooms: \d+ rows visible.*API count: \d+/m;
    if(-d $dir && !-f "$dir/state.json"){
        opendir my $existing,$dir or die $!;
        my @files=grep {$_ ne '.'&&$_ ne '..'&&$_ ne '.workflow.lock'} readdir $existing;
        closedir $existing;
        die "Existing historical/partial directory has no managed state; do not overwrite\n" if @files && !-f "$dir/preparation.json";
    }
    else{make_path($dir);}
}else{die "Batch not prepared\n" unless -d $dir&&-f "$dir/state.json";}
die 'Symlinked workflow metadata' if grep {-l "$dir/$_"} qw(.workflow.lock state.json preparation.json manifest.json scenes.json review.json crop-layout.json);
open my $lock,'>>',"$dir/.workflow.lock" or die $!;
flock($lock,LOCK_EX|LOCK_NB) or die "Another batch stage is running\n";
my $state=-f "$dir/state.json"?json("$dir/state.json"):undef;
sub state_save {atomic_json("$dir/state.json",$state)}
if($action eq 'prepare'&&!$state){
    my $preparation=-f "$dir/preparation.json"?json("$dir/preparation.json"):undef;
    my $manifest;
    if($preparation){
        die 'Invalid preparation receipt' unless $preparation->{batch} eq $batch&&$preparation->{splitter_sha256} eq digest('tools/artwork/split-composite.pl');
        $manifest=$preparation->{manifest};
    }else{
    my($excluded,$ids,$paths)=exclusions();my $inventory=csv_rows('reports/artwork-inventory.csv');my @selected;
    for my $r(@$inventory){
        next unless $r->{Door} eq 'PDD'&&$r->{'Image status'} eq 'MISSING_LOCAL'&&$r->{Source} eq 'Supabase rooms';
        next if $excluded->{$r->{'PDD number'}}||$ids->{$r->{'Record ID'}};
        next if exists_any($r->{'Expected image filename'});
        push @selected,$r;last if @selected==10;
    }
    die "Fewer than ten eligible records\n" unless @selected==10;
    my $config=bytes('src/story.js');my($url)=$config=~/url:\s*"([^"]+)"/;my($key)=$config=~/key:\s*"([^"]+)"/;
    die 'Missing browser configuration' unless $url&&$key;
    my $query=join(',',map {0+$_->{'PDD number'}}@selected);
    my $live=decode_json(capture('curl','--fail','--silent','--show-error','--max-time','30',
        "$url/rest/v1/rooms?select=id,pdd,word,short_definition,description&pdd=in.($query)",'-H',"apikey: $key"));
    die 'Incomplete vocabulary query' unless ref($live) eq 'ARRAY'&&@$live==10;
    my %live=map {$_->{pdd}=>$_}@$live;my @panels;
    for my $i(0..9){my $source=$selected[$i];my $r=$live{$source->{'PDD number'}};
        die 'Live record ID changed' unless $r&&$r->{id}==$source->{'Record ID'};
        push @panels,{position=>$i+1,row=>int($i/5)+1,column=>$i%5+1,pdd=>$r->{pdd},supabase_record_id=>$r->{id},
            word=>$r->{word},short_definition=>$r->{short_definition},description=>$r->{description},expected_filename=>"images/pdd$r->{pdd}.jpg"};
    }
    $manifest={columns=>5,rows=>2,panel_aspect_ratio=>'2:3',composite_aspect_ratio=>'5:3',preferred_composite_pixels=>[5000,3000],
        excluded_manifests=>$paths,selection=>'Next ten missing PDDs in refreshed inventory order, excluding earlier assignments and current artwork',panels=>\@panels};
    validate_manifest($manifest);
    atomic_json("$dir/preparation.json",{batch=>$batch,manifest=>$manifest,splitter_sha256=>digest('tools/artwork/split-composite.pl')});
    }
    validate_manifest($manifest);
    publish_same("$dir/manifest.json",json_bytes($manifest));
    publish_same("$dir/split-composite.pl",bytes('tools/artwork/split-composite.pl'));
    publish_same("$dir/README.md",encode('UTF-8',"# PDD artwork Batch $batch\n\nManaged review-only workflow. Never installs artwork.\n\nRead manifest.json for frozen selection and vocabulary sources, prompt.md for the final generation prompt, state.json for progress. Run the Codex skill again to resume; do not manually mark complete.\n\nReview outputs: paintings/ and gallery.html. The original composite.png is preserved. Exact grid positions and any inspected crop_layout are recorded in the manifest. No earlier crop coordinates are reused.\n\nNo gameplay, database or production artwork writes. See tools/artwork/README.md for the staged command interface.\n"));
    $state={batch=>$batch,phase=>'selected',installation=>'never',manifest_sha256=>digest("$dir/manifest.json"),splitter_sha256=>digest("$dir/split-composite.pl")};state_save();
}
my $manifest=json("$dir/manifest.json");validate_manifest($manifest);
die "Frozen manifest changed; stop\n" if $state->{manifest_sha256} ne digest("$dir/manifest.json");
die 'Splitter changed' unless $state->{splitter_sha256} eq digest("$dir/split-composite.pl");
if($action eq 'plan'){
    die 'Generation already started; prompt is frozen' if $state->{composite_sha256}||$state->{phase} eq 'generating';
    my $scenes=json("$dir/scenes.json");die 'Ten scene descriptions required' unless ref($scenes) eq 'ARRAY'&&@$scenes==10;
    my $prompt=decode('UTF-8',bytes('tools/artwork/prompt-header.txt'));
    for my $i(0..9){my $s=$scenes->[$i];die 'Scene identity/description invalid' unless $s->{position}==$i+1&&$s->{pdd}==$manifest->{panels}[$i]{pdd}&&length($s->{scene}//'')>=60;
        $prompt.="\n".($i==0?"TOP ROW, LEFT TO RIGHT:\n":$i==5?"BOTTOM ROW, LEFT TO RIGHT:\n":'').($i+1).". $s->{scene}\n";
    }
    my $body=encode('UTF-8',$prompt);
    if(exists_any("$dir/prompt.md")){die 'Existing prompt differs; do not overwrite' unless bytes("$dir/prompt.md") eq $body}
    else{exclusive("$dir/prompt.md",$body)}
    $state->{prompt_sha256}=digest("$dir/prompt.md");$state->{phase}='prompt_ready';state_save();
}
if($action eq 'begin-generation'){
    die 'Not ready for a new generation; do not duplicate paid calls' unless $state->{phase} eq 'prompt_ready'&&!exists_any("$dir/composite.png");
    die 'Prompt changed' unless $state->{prompt_sha256} eq digest("$dir/prompt.md");
    $state->{phase}='generating';state_save();
}
if($action eq 'blocked'){
    die 'Supply the actual failure reason' unless @args&&length(join(' ',@args))>2;
    $state->{phase}='blocked';$state->{blocked_reason}=join(' ',@args);state_save();
}
if($action eq 'save-composite'){
    die 'Supply generated output path' unless @args==1;
    die 'Generation was not started' unless $state->{phase} eq 'generating'||$state->{composite_sha256};
    my $input=abs_path($args[0]) or die 'Generated output unavailable';
    my(undef,undef,$format)=image_info($input);die 'Expected real PNG output' unless $format eq 'png';
    my $dest="$dir/composite.png";
    if(exists_any($dest)){die 'Existing composite differs; no overwrite' unless !-l $dest&&digest($dest) eq digest($input)}
    else{exclusive($dest,bytes($input))}
    $state->{composite_sha256}=digest($dest);$state->{manifest_sha256}=digest("$dir/manifest.json");$state->{phase}='composite_saved';state_save();
}
if($action eq 'split'){
    die 'No genuine saved composite' unless $state->{composite_sha256}&&digest("$dir/composite.png") eq $state->{composite_sha256};
    die 'Prompt changed' unless $state->{prompt_sha256} eq digest("$dir/prompt.md");
    if(-f "$dir/crop-layout.json"){
        my $layout=json("$dir/crop-layout.json");
        die 'Cannot change crop layout after split' if $state->{outputs}&&JSON::PP->new->canonical->encode($layout) ne JSON::PP->new->canonical->encode($manifest->{crop_layout});
        $manifest->{crop_layout}=$layout;
        atomic_json("$dir/manifest.json",$manifest);$state->{manifest_sha256}=digest("$dir/manifest.json");state_save();
    }
    # Stage once; a failed/partial publication resumes from these exact bytes.
    my $stage="$dir/.split-pending";
    die 'Symlinked split staging' if -l $stage||-l "$stage/receipt.json";
    if(!-f "$stage/receipt.json"){
        die 'Incomplete staging directory; inspect it before retrying' if exists_any($stage);
        make_path($stage);
        system($^X,"$dir/split-composite.pl","$dir/composite.png","$stage/paintings")==0 or die 'Split failed; batch remains incomplete';
        my %hash=map {my $n=basename($_->{expected_filename});$n=>digest("$stage/paintings/$n")}@{$manifest->{panels}};
        exclusive("$stage/receipt.json",json_bytes({composite_sha256=>$state->{composite_sha256},manifest_sha256=>$state->{manifest_sha256},files=>\%hash}));
    }
    my $receipt=json("$stage/receipt.json");
    die 'Staging no longer matches source/layout' unless $receipt->{composite_sha256} eq digest("$dir/composite.png")&&$receipt->{manifest_sha256} eq digest("$dir/manifest.json");
    die 'Symlinked review folder' if -l "$dir/paintings";make_path("$dir/paintings");
    for my $p(@{$manifest->{panels}}){my $n=basename($p->{expected_filename});my $dest="$dir/paintings/$n";
        die 'Staged image changed' unless digest("$stage/paintings/$n") eq $receipt->{files}{$n};
        if(exists_any($dest)){die "Refusing changed/existing review file $dest" if -l $dest||digest($dest) ne $receipt->{files}{$n}}
        else{exclusive($dest,bytes("$stage/paintings/$n"))}
    }
    $state->{outputs}=$receipt->{files};$state->{phase}='split';state_save();
}
sub html {my $s=shift;$s=~s/&/&amp;/g;$s=~s/</&lt;/g;$s=~s/>/&gt;/g;$s=~s/"/&quot;/g;$s}
sub validate_outputs {
    die 'Batch has not been split' unless $state->{outputs};
    die 'Composite changed' unless digest("$dir/composite.png") eq $state->{composite_sha256};
    die 'Prompt changed' unless digest("$dir/prompt.md") eq $state->{prompt_sha256};
    my @files=glob "$dir/paintings/*.jpg";die 'Exactly ten JPGs required' unless @files==10;
    my($width,$height);my @details;
    for my $p(@{$manifest->{panels}}){my $n=basename($p->{expected_filename});my $file="$dir/paintings/$n";
        die 'Review output changed' if -l $file||digest($file) ne $state->{outputs}{$n};
        my($w,$h,$format)=image_info($file);die 'Not equal portrait 2:3 JPGs' unless $format eq 'jpeg'&&$w*3==$h*2&&$h>$w&&(!defined($width)||$width==$w&&$height==$h);
        ($width,$height)=($w,$h);push @details,{position=>$p->{position},pdd=>$p->{pdd},filename=>$n,width=>$w,height=>$h,sha256=>digest($file)};
    }
    return (\@details,$width,$height);
}
if($action eq 'validate'||$action eq 'complete'){
    my($details,$w,$h)=validate_outputs();
    my $gallery="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>PDD Batch $batch review</title><style>body{background:#e8ddc8;color:#514839;font-family:Georgia,serif;padding:24px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}figure{margin:0}img{width:100%;height:auto}figcaption{overflow-wrap:anywhere}\@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>PDD Batch $batch — review only</h1><p>Ten ${w}×${h} portraits, in manifest order. Not installed.</p><a href=\"composite.png\">Original composite</a><div class=\"grid\">";
    for my $p(@{$manifest->{panels}}){my $n=basename($p->{expected_filename});my $word=html($p->{word});$gallery.="<figure><a href=\"paintings/$n\"><img src=\"paintings/$n\" width=\"$w\" height=\"$h\" alt=\"$word\"></a><figcaption>$p->{position}. PDD $p->{pdd} — $word<br>$n</figcaption></figure>";}
    $gallery.='</div></html>';
    if(-f "$dir/gallery.html"){die 'Existing gallery differs' unless bytes("$dir/gallery.html") eq encode('UTF-8',$gallery)}else{exclusive("$dir/gallery.html",encode('UTF-8',$gallery))}
    atomic_json("$dir/validation.json",{outputs=>$details,composite_sha256=>$state->{composite_sha256},manifest_sha256=>digest("$dir/manifest.json"),prompt_sha256=>$state->{prompt_sha256},installation=>'never'});
    $state->{gallery_sha256}=digest("$dir/gallery.html");
    $state->{validation_sha256}=digest("$dir/validation.json");
    if($action eq 'complete'){
        my $review=json("$dir/review.json");
        die 'Visual review does not match artifacts' unless $review->{composite_sha256} eq $state->{composite_sha256}&&$review->{manifest_sha256} eq digest("$dir/manifest.json")&&$review->{prompt_sha256} eq $state->{prompt_sha256};
        die 'All ten visual positions must be reviewed' unless JSON::PP::is_bool($review->{visual_review_passed})&&$review->{visual_review_passed}&&ref($review->{positions_reviewed}) eq 'ARRAY'&&join(',',@{$review->{positions_reviewed}}) eq '1,2,3,4,5,6,7,8,9,10'&&defined $review->{issues};
        $state->{review_sha256}=digest("$dir/review.json");$state->{phase}='review_ready';
    }else{$state->{phase}='validated_awaiting_visual_review' unless $state->{phase} eq 'review_ready'}
    state_save();
}
if($state->{phase} eq 'review_ready'){
    validate_outputs();die 'Review changed' unless digest("$dir/review.json") eq $state->{review_sha256};
    die 'Review report/contact sheet changed' unless digest("$dir/gallery.html") eq $state->{gallery_sha256}&&digest("$dir/validation.json") eq $state->{validation_sha256};
}
print "Batch $batch: $state->{phase}\n$dir\n";
print "Do not generate again while phase is generating; recover the prior output or explicitly resolve the interrupted call.\n" if $state->{phase} eq 'generating';
print "Review: $dir/gallery.html — NEVER installed automatically.\n" if $state->{phase} eq 'review_ready';
