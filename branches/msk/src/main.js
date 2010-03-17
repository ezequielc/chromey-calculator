(function(window, document, localStorage, undefined){

/*** variables ***/
var $links = $("#links"), $input = $("#input > input"), $output = $("#output"), background = chrome.extension.getBackgroundPage();
$links.$span = $links.children("span"); $links.$a = $links.children("a");

var commands = {
	clear: Shell.clear,
	help: function(){ window.open("help.html", "chromey-help"); },
	options: function(){ window.open("options.html", "chromey-options"); },
	popout: function(){
		$input.val().trim().toLowerCase() === "popout" && $input.val("");
		saveData();
		
		var p = JSON.parse(localStorage.popout || '{"top":100,"left":100,"width":450,"height":450}');
		window.open("calc.html#popout", "chromey-popout", "top=" + p.top + ",left=" + p.left + ",width=" + p.width + ",height=" + p.height);
	}
};


/*** setup ***/
$input.focus(); // focus the input

if (window.location.hash !== "#popup") {
	$("body").css("width", "auto");
	$("#output").css({ height: "auto", marginBottom: "26px" });
	$("#input").css({ position: "fixed", bottom: 0 });
}

if ("v" in localStorage) {
	loadData();
} else {
	localStorage.v = "4";
}

$("#output").add(document).scrollTop(1e6);


/*** events ***/
$output.find(".output > a")
	.live("mouseenter", function(){ $(this).stop().css("opacity", 1); }) // show the link (if any) to the result source
	.live("mouseleave", function(){ $(this).animate({ opacity: 0 }, 500); }) // hide the link
	.live("click", function(e){ // handle clicking on source links
		if (e.ctrlKey || e.metaKey) { // handle ctrl and command-clicking
			Copy($(this).css("opacity", 0).animate({ opacity: 1 }, 700).attr("href"));
			return false;
		}
	});

$(window).bind("unload blur", function(){
	saveData();
	updateViews();
});

$(document).click(function(){ $input.focus(); }).add("#output").scroll(function(){ $input.focus(); }); // refocus the input no matter what is clicked

$input.keydown(function(e){ // handle enter and up/down keypresses
	var val = this.value.trim(), a;
	
	if (e.which === 13 && val) { // enter
		if (a = commands[val.toLowerCase()]) { // commands
			a();
		} else if (a = val.match(/^@(\w+)\s*=\s*(.+)/)) { // we're setting a variable
			Vars.add(a[1], a[2], function(result, source){
				Shell.io("@" + a[1] + " = " + a[2], result, source);
			});
		} else if (m = val.match(/^@(\w+)\s*=?$/)) { // we're getting a variable
			var v = Vars.list[a[1]] || { original: "", value: "undefined", source: ["", ""] };
			Shell.raw("@" + a[1] + " =", "input");
			Shell.raw(v.original, "replaced");
			Shell.raw(v.value, "output").prepend($("<a/>", { html: v.source[0], href: v.source[1], target: "_tab" }).animate({ opacity: 0 }, 1500));
		} else { // try calculating it
			var input = val.replace(/\s*=$/, ""); // remove trailing =
			calc(input, function(result, source, replace){
				// add the result
				Shell.io(input + " =", result, source, replace && replace + " =");
				
				var $results = $output.children();
				
				$results.length > 400 && $results.slice(0, $results.length - 400).remove(); // limit number of results
				
				saveData();
				updateViews();
			});
		}
		
		Shell.hist.add(val); // add to the history
		this.value = ""; // clear the input
	} else if (e.which === 38) { // up arrow
		this.value = Shell.hist.up(val); // go up in the history
		
		setTimeout(function(){
			$input[0].selectionStart = $input[0].selectionEnd = $input.val().length; // set cursor position to end of input
		}, 0);
	} else if (e.which === 40) { // down arrow
		this.value = Shell.hist.down(val); // go down in the history
	}
}).blur(function(){ // save caret position so we can insert/replace text at it
	$input.data("selection", { start: this.selectionStart, end: this.selectionEnd });
});

$output.find(".input, .output").live("click", function(e){ // handle clicking on inputs and results
	var $this = $(this), result = $this.contents().last().text().trim().replace(/\s*=$/, "");
	
	if (e.ctrlKey || e.metaKey) { // handle ctrl and command-clicking
		Copy(result); // copy the result to the clipboard
		$this.css("opacity", 0).animate({ opacity: 1 }, 700);
	} else { // insert result into the input (replacing any selection with it)
		var cval = $input.val(), sel = $input.data("selection"),
			head = cval.substring(0, sel.start), tail = cval.substring(sel.end);
		
		sel.start = sel.end = sel.start + result.length;
		$input.val(head + result + tail);
		
		$input.focus();
		
		$input[0].selectionStart = $input[0].selectionEnd = sel.start; // put cursor at the end of the inserted result
	}
});

$links.$a.click(function(){
	var open = $links.$span.is(":visible");
	$links.$a.text(open ? "<" : ">");
	$links.$span[open ? "hide" : "show"]();
	localStorage.linksOpen = !open;
});

$links.$span.children().each(function(){
	var $this = $(this);
	$this.click(function(){ commands[$this.html().toLowerCase()](); });
});

/*** functions ***/
function saveData() {
	localStorage.hist = JSON.stringify(Shell.hist);
	localStorage.vars = JSON.stringify(Vars.list);
	localStorage.ans = calc.ans;
	localStorage.input = $input.val();
	localStorage.results = $output.html();
	
	if (window.location.hash === "#popout") {
		localStorage.popout = JSON.stringify({
			top: window.screenTop,
			left: window.screenLeft,
			width: window.innerWidth,
			height: window.innerHeight
		});
	}
}

function loadData() {
	Shell.hist.set(JSON.parse(localStorage.hist));
	Vars.list = JSON.parse(localStorage.vars);
	calc.ans = localStorage.ans;
	$input.val(localStorage.input);
	$output.html(localStorage.results);
	
	var linksOpen = "linksOpen" in localStorage ? JSON.parse(localStorage.linksOpen) : true;
	$links.$span[linksOpen ? "show" : "hide"]().siblings("a").text(linksOpen ? ">" : "<");
}

function updateViews() {
	background.updateViews(window);
}

function Copy(v) { // copies text to the clipboard
	var txt = $("<textarea/>").val(v).css({ position: "absolute", left: "-100%" }).appendTo("body");
	txt[0].select();
	document.execCommand("Copy");
	txt.remove();
}

})(this, this.document, this.localStorage);