FRONTENDS = [];

function update_frontend(data, keyl) {
    FRONTENDS.forEach(function(port) {
        port.postMessage({
            type: 'update',
            data: data,
            key_list: keyl
        });
    });
}

HISTORY = [];

function update_from_storage() {
    chrome.storage.local.get({
            data: {},
            key_list: []
        },
        function(r) {
            if (HISTORY.length === 0) HISTORY.push(r);
            update_frontend(r.data, r.key_list);
        }
    );
}

function update_storage(data, keyl) {
    var r = {
        data: data,
        key_list: keyl
    };
    chrome.storage.local.set(r, function() {
        HISTORY.push(r);
        update_frontend(data, keyl);
    });
}

function undo() {
    if (HISTORY.length <= 1) return false;
    var r = HISTORY.pop();
    var n = HISTORY.length;
    var p = HISTORY[n - 1];
    chrome.storage.local.set(p,
        function() {update_frontend(p.data, p.key_list);}
    );
}

function key_list_include(keyl, k) {
    return keyl.reduce(function(prev, l) {return prev || l.includes(k);}, false);
}

function extend_with_tab(value, tab) {
    return $.extend({
        type: 'referred_link',
        referrer_url: tab.url,
        referrer_title: tab.title,
        referrer_favicon: tab.favIconUrl
    }, value);
}

DEFAULT_VALUE = {
    text: '',
    type: 'simple_link',
    referrer_url: '',
    referrer_title: '',
    referrer_favicon: '',
    comment: ''
};

function add_to_storage(key, value) {
    chrome.storage.local.get({
        data: {},
        key_list: []
    }, function(r) {
        var data = r.data;
        var keyl = r.key_list;
        var val = $.extend({}, DEFAULT_VALUE, data[key], value);
        data[key] = val;
        if (!key_list_include(keyl, key))
            if (keyl.length > 0) keyl[0].push(key);
            else keyl.push([key]);
        update_storage(data, keyl);
    });
}

function delete_from_storage(keys) {
    chrome.storage.local.get({
        data: {},
        key_list: []
    }, function(r) {
        var data = r.data;
        var keyl = r.key_list;
        keys.forEach(function(key) {delete data[key];});
        keyl = keyl
            .map(function(l) {
                return l.filter(function(k) {return !keys.includes(k);});
            })
            .filter(function(l) {return l.length > 0;});
        update_storage(data, keyl);
    });
}

function key_list_equal(keyl1, keyl2) {
    return (keyl1.length === keyl2.length) && keyl1.reduce(function(prev, l1, i) {
        var l2 = keyl2[i];
        return prev && (l1.length === l2.length) &&
            l1.reduce(function(p, s1, j) {return p && s1 === l2[j];}, true);
    }, true);
}

function update_key_list(keyl) {
    var n = HISTORY.length;
    var r = HISTORY[n - 1];
    if (key_list_equal(keyl, r.key_list))
        update_frontend(r.data, r.key_list);
    else chrome.storage.local.get({
        data: {},
        key_list: []
    }, function(r) {
        var data = r.data;
        update_storage(data, keyl);
    });
}

function query_opened_view(on_found) {
    chrome.tabs.query({url: chrome.extension.getURL('view.html')},
        function(tabs) {
            if (tabs.length === 0) {
                chrome.tabs.create({url: chrome.extension.getURL('view.html')});
            } else {if (on_found) on_found(tabs[0]);}
        }
    );
}

function query_active_tab(on_found) {
    chrome.tabs.query({active: true}, function(tabs) {if (tabs.length > 0 && on_found) on_found(tabs[0]);});
}

function query_highlight(tab, on_hl, on_not_hl) {
    chrome.tabs.executeScript(tab.id, {
            code: '[typeof MINITAB_INJECTED === "undefined",' +
                'typeof HIGHLIGHTED !== "undefined" && HIGHLIGHTED]'
        },
        function(r) {
            if (chrome.runtime.lastError) {activate_view();} else {
                if (r[0][0]) {
                    chrome.tabs.executeScript(tab.id, {file: 'lib/jquery-2.0.3.min.js'});
                    chrome.tabs.executeScript(tab.id, {file: 'js/content.js'});
                }
                if (r[0][1]) {if (on_hl) on_hl(tab);} else {if (on_not_hl) on_not_hl(tab);}
            }
        }
    );
}

function toggle_highlight(tab) {
    chrome.tabs.executeScript(tab.id, {file: 'js/content-toggle.js'});
}

function archive_tab(tab) {
    if (tab.url === chrome.extension.getURL('view.html')) return false;
    add_to_storage(tab.url, {
        text: tab.title,
        referrer_favicon: tab.favIconUrl // borrow for favicon
    });
    chrome.tabs.remove(tab.id);
}

function activate_view() {
    query_opened_view(function(tab) {
        chrome.tabs.update(tab.id, {active: true});
    });
}

function toggle_highlight_after_query(tab) {query_highlight(tab, toggle_highlight, toggle_highlight);}

RIGHT_CLICK_INFO = null;

chrome.runtime.onMessage.addListener(function(msg, sender) {
    if (msg.type === 'cache-right-click-info') RIGHT_CLICK_INFO = {
        key: msg.key,
        value: extend_with_tab(msg.value, sender.tab)
    };
});

chrome.runtime.onConnect.addListener(function(port) {
    if (!['view', 'content'].includes(port.name)) return false;
    FRONTENDS.push(port);
    port.onMessage.addListener(function(msg, port) {
        if (msg.type === 'init') update_from_storage();
        else if (msg.type === 'insert-record-with-tab') add_to_storage(msg.key, extend_with_tab(msg.value, port.sender.tab));
        else if (msg.type === 'insert-record-without-tab') add_to_storage(msg.key, msg.value);
        else if (msg.type === 'delete-records') delete_from_storage(msg.keys);
        else if (msg.type === 'truncate-all') update_storage({}, []);
        else if (msg.type === 'update-key-list') update_key_list(msg.key_list);
        else if (msg.type === 'undo-one-step') undo();
        else if (msg.type === 'toggle-highlight') toggle_highlight_after_query(msg.tab);
    });
    port.onDisconnect.addListener(function() {
        FRONTENDS = FRONTENDS.filter(function(v) {return v !== port;});
    });
});

function cmd_activate_view() {activate_view();}

function cmd_archive_active_tab() {query_active_tab(archive_tab);}

function cmd_toggle_active_tab_highlight() {query_active_tab(toggle_highlight_after_query);}

function cmd_magic_menu_click() {
    query_opened_view(function(view_tab) {
        query_active_tab(function(tab) {query_highlight(tab, archive_tab, toggle_highlight);});
    });
}

chrome.browserAction.onClicked.addListener(cmd_magic_menu_click);

chrome.contextMenus.create({
    title: 'Archive This Tab',
    contexts: ['browser_action'],
    onclick: cmd_archive_active_tab
});

chrome.contextMenus.create({
    title: 'Toggle Highlight',
    contexts: ['browser_action'],
    onclick: cmd_toggle_active_tab_highlight
});

chrome.contextMenus.create({
    title: 'Archive this link',
    contexts: ['link'],
    onclick: function() {add_to_storage(RIGHT_CLICK_INFO.key, RIGHT_CLICK_INFO.value);}
});

chrome.commands.onCommand.addListener(function(command) {
    if (command == 'archive-active-tab') cmd_archive_active_tab();
    else if (command == 'toggle-active-tab-highlight') cmd_toggle_active_tab_highlight();
});
