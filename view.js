function domain(url) {
    return url.replace(/^[^:]+:\/\/(?:www\.)?([^\/]*).*$/, '$1');
}

function px_val(elem, key) {
    return parseInt(elem.css(key).replace(/px/, ''));
}

function make_link_box(url, title, favicon) {
    return $('<div/>', {
            class: 'link-box'
        })
        .append($('<div/>', {
                class: 'favicon'
            })
            .css('background-image', 'url(' + (favicon ? favicon : 'globe.svg') + ')'))
        .append($('<a/>', {
                class: 'link',
                href: url,
                html: title ? title : url
            })
            .click(function(e) {
                if (CLICK_LOCK) return false;
                chrome.tabs.create({
                    url: url,
                    active: false
                });
                if (url && !e.metaKey)
                    PORT.postMessage({
                        type: 'delete_from_onetab',
                        keys: [url]
                    });
                return false;
            })
        );
}

function make_referer_link_box(url, title, favicon) {
    return $('<div/>', {
            class: 'link-box'
        })
        .append($('<div/>', {
                class: 'favicon'
            })
            .css('background-image', 'url(' + favicon + ')'))
        .append($('<a/>', {
                class: 'link',
                href: url,
                html: title ? title : url
            })
            .click(function(e) {
                if (CLICK_LOCK) return false;
                if (e.metaKey)
                    chrome.tabs.create({
                        url: url,
                        active: false
                    }, function(tab) {
                        PORT.postMessage({
                            type: 'analyze_tab',
                            tab: tab
                        });
                    });
                else
                    chrome.tabs.create({
                        url: url,
                        active: true
                    });
                return false;
            }));
}

function make_delete_box(url) {
    return $('<div/>', {
            class: 'delete-link'
        })
        .click(function(e) {
            PORT.postMessage({
                type: 'delete_from_onetab',
                keys: [url]
            });
        });
}

function make_comment_box(url, comment) {
    return $('<input/>', {
            value: comment ? comment : domain(url),
            class: 'link-comment'
        })
        .change(function() {
            PORT.postMessage({
                type: 'save_to_onetab',
                key: url,
                value: {
                    comment: this.value
                }
            });
        });
}

function construct_new_sorted_key() {
    return $('.group:has(.entry)')
        .map(function(i, g) {
            return [
                $('.entry', g).map(function(j, e) {
                    return $(e).attr('url');
                })
                .toArray()
                .reverse()
            ];
        })
        .toArray();
}

CLICK_LOCK = false;

function update(data, sorted_key) {
    if (data) DATA = data;
    if (sorted_key) SORTED_KEY = sorted_key;
    $('#main-container').empty();
    SORTED_KEY.forEach(function(l) {
        $('<div/>', {
                class: 'group inter-group'
            })
            .appendTo('#main-container');

        var group = $('<div/>', {
                class: 'group group-sortable'
            })
            .appendTo('#main-container');
        l.forEach(function(url) {
            var val = DATA[url];
            if (val.has_referer)
                $('<div/>', {
                    class: 'entry',
                    url: url
                })
                .append(make_delete_box(url))
                .append(make_link_box(url, val.text, ''))
                .append($('<div/>', {
                    class: 'inter-link'
                }))
                .append(make_referer_link_box(val.referer_url, val.referer_title, val.referer_favicon))
                .append(make_comment_box(url, val.comment))
                .prependTo(group);
            else
                $('<div/>', {
                    class: 'entry',
                    url: url
                })
                .append(make_delete_box(url))
                .append(make_link_box(url, val.text, val.referer_favicon))
                .append(make_comment_box(url, val.comment))
                .prependTo(group);
        });
    });

    $('<div/>', {
            class: 'group inter-group'
        })
        .appendTo('#main-container');

    $('.group').sortable({
        connectWith: '.group',
        items: '.entry',
        axis: 'y',
        delay: 100,
        start: function() {
            CLICK_LOCK = true;
        },
        change: function(e, ui) {
            if (ui.sender === null)
                $('.group.inter-group').each(function() {
                    var s = $(this);
                    if ($('.entry', s).length > 0) s.addClass('visible'); 
                    else s.removeClass('visible'); 
                });
        },
        stop: function() {
            CLICK_LOCK = false;
        },
        update: function(e, ui) {
            if (ui.sender === null)
                PORT.postMessage({
                    type: 'update_sorted_key',
                    sorted_key: construct_new_sorted_key()
                });
        }
    });

    $('#main-container').sortable({
        axis: 'y',
        items: '.group.group-sortable',
        delay: 100,
        start: function () {
            $('.group.group-sortable').css('margin', '10px 0');
            $('.group.inter-group').remove();
        },
        update: function(e, ui) {
            if (ui.sender === null)
                PORT.postMessage({
                    type: 'update_sorted_key',
                    sorted_key: construct_new_sorted_key()
                });
        }
    });
}

PORT = chrome.runtime.connect({
    name: "view"
});

PORT.onMessage.addListener(function(msg) {
    if (msg.type == 'update') {
        update(msg.data, msg.sorted_key);
        document.title = Object.keys(msg.data).length + ' Links';
    }
});

$('body').keypress(function(e) {
    console.log(e.which);
    if (e.which === 122) $('#reverse-button').click();
});

PORT.postMessage({
    type: 'init'
});

$('<a/>', {
        class: 'ui-button ui-button-icon-only',
        id: 'reverse-button'
    })
    .click(function() {
        PORT.postMessage({
            type: 'undo_last_step'
        });
    })
    .appendTo('#toolbar');

$('<a/>', {
        class: 'ui-button ui-button-icon-only',
        id: 'clear-all-button'
    })
    .click(function() {
        PORT.postMessage({
            type: 'clear_all_data'
        });
    })
    .appendTo('#toolbar');
