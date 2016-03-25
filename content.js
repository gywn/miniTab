function px_val(elem, key) {return parseInt(elem.css(key).replace(/px/, ''));}

function get_favicon() {
    var f = $('link[rel="icon"][href], link[rel="apple-touch-icon"][href], link[rel="shortcut icon"][href]');
    if (f.length > 0) return f[0].href;
    else return '';
}

LINK_ID = 0;

function update_overlays() {
    $('a[href]').each(function() {
        var a = $(this);
        var id = a.attr('link-overlay-id');
        var ov;
        if (!id) {
            id = 'link-overlay-' + (++LINK_ID);
            a.attr('link-overlay-id', id);

            ov = $('<div>', {
                    class: 'link-overlay',
                    id: id,
                    url: this.href,
                    _text: a.text()
                })
                .css({
                    width: a.outerWidth() + 4,
                    height: a.outerHeight() + 4,
                    left: a.offset().left - 2,
                    top: a.offset().top - 2,
                    // 'border-radius': px_val(a, 'border-radius') + 3
                })
                .click(function() {
                    var url = $(this).attr('url');
                    var text = $(this).attr('_text');
                    if (URLS.includes(url)) {
                        console.log('delete');
                        PORT.postMessage({type: 'delete-records', keys: [url]});
                    } else {
                        PORT.postMessage({
                            type: 'insert-record',
                            key: url,
                            value: {
                                text: text,
                                referer_url: document.location.href,
                                referer_title: document.title,
                                referer_favicon: get_favicon()
                            }
                        });
                    }
                })
                .appendTo('body');
        } else ov = $('#' + id);

        if (URLS.includes(this.href)) ov.addClass('recorded');
        else ov.removeClass('recorded');
    });
}

ONETAB_INJECTED = true;
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