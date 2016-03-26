function px_val(elem, key) {return parseInt(elem.css(key).replace(/px/, ''));}

function get_favicon() {
    var f = $('link[rel="icon"][href], link[rel="apple-touch-icon"][href], link[rel="shortcut icon"][href]');
    if (f.length > 0) return f[0].href;
    else return '';
}

function prepare_anchor(a) {
    a.attr('old-style', a.attr('style') || '')
        .attr('link-prepared', '')
        .mouseenter(function() {
            a.attr('mouseon', '');
            set_anchor_style(a);
        })
        .mouseleave(function() {
            a.removeAttr('mouseon');
            set_anchor_style(a);
        })
        .click(function() {
            if (!HIGHLIGHTED) return true;

            var url = this.href;
            if (URLS.includes(url)) {
                PORT.postMessage({
                    type: 'delete-records',
                    keys: [url]
                });
            } else {
                PORT.postMessage({
                    type: 'insert-record-with-tab',
                    key: url,
                    value: {text: $(this).text()}
                });
            }
            return false;
        });
}

function set_anchor_style(a) {
    var incl = URLS.includes(a[0].href);

    a.attr('style', a.attr('old-style'));
    if (!HIGHLIGHTED) return false;
    if (incl || a.attr('mouseon') === '')
        a.css({
            'text-decoration': 'none',
            'border-radius': '3px',
            cursor: 'default'
        });
    if (incl) a.css({
        background: '#FFE57F',
        color: '#4E342E'
    });
    else if (a.attr('mouseon') === '') a.css({
        background: '#FFFF8D',
        color: 'black'
    });
}

function update_overlays() {
    $('a[href]:parent').each(function() {
        var a = $(this);
        if (a.attr('link-prepared') !== '') prepare_anchor(a);
        set_anchor_style(a);
    });
    if (HIGHLIGHTED) $('#minitab-overlay').show();
    else $('#minitab-overlay').hide();
}

MINITAB_INJECTED = true;
HIGHLIGHTED = false;
URLS = [];

PORT = chrome.runtime.connect({name: "content"});

PORT.onMessage.addListener(function(msg) {
    if (msg.type == 'update') {
        URLS = [].concat.apply([], msg.key_list);
        update_overlays();
    }
});

$('body').keypress(function(e) {
    console.log(e.which);
    if (e.which === 122) PORT.postMessage({type: 'undo-one-step'});
});

$('<div id=minitab-overlay>').appendTo('body');
