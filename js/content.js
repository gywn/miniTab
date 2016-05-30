/* global chrome, $ */

var MINITAB_INJECTED = true;
var MINITAB_HIGHLIGHTED = false;
var MINITAB_PORT = chrome.runtime.connect({name: 'content'});

var MINITAB_UPDATE_OVERLAYS = (function () {
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
                if (!MINITAB_HIGHLIGHTED) return true;

                var url = this.href;
                if (URLS.includes(url)) {
                    MINITAB_PORT.postMessage({
                        type: 'delete-records',
                        keys: [url]
                    });
                } else {
                    MINITAB_PORT.postMessage({
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
        if (!MINITAB_HIGHLIGHTED) return false;
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
        if (MINITAB_HIGHLIGHTED) $('#minitab-overlay').show();
        else $('#minitab-overlay').hide();
    }

    var URLS = [];

    MINITAB_PORT.onMessage.addListener(function(msg) {
        if (msg.type === 'update') {
            URLS = [].concat.apply([], msg.key_list);
            update_overlays();
        }
    });

    $('body').keypress(function(e) {
        console.log(e.which);
        if (e.which === 122) MINITAB_PORT.postMessage({type: 'undo-one-step'});
    });

    $('<div id=minitab-overlay>').appendTo('body');

    return update_overlays;
})();
