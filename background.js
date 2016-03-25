function analyze_tab(t) {
    chrome.tabs.executeScript(t.id, {
            code: 'typeof ONETAB_INJECTED == "undefined";'
        },
        function(r) {
            if (r[0]) {
                chrome.tabs.executeScript({
                    file: 'jquery-2.0.3.min.js',
                    runAt: 'document_end'
                });
                chrome.tabs.executeScript({
                    file: 'content.js',
                    runAt: 'document_end'
                });
            }
            chrome.tabs.executeScript({
                file: 'content-toggle.js'
            });
        }
    );
}

function open_onetab() {
    chrome.tabs.create({
        url: chrome.extension.getURL('view.html')
    });
}

FRONTENDS = [];

function update_frontend(data, sorted_key) {
    FRONTENDS.forEach(function(port) {
        port.postMessage({
            type: 'update',
            data: data,
            sorted_key: sorted_key
        });
    });
}

DATA_HISTORY = [];
SKEY_HISTORY = [];

function update_from_storage() {
    chrome.storage.local.get({
            data: {},
            sorted_key: []
        },
        function(r) {
            if (DATA_HISTORY.length === 0) {
                DATA_HISTORY.push(r.data);
                SKEY_HISTORY.push(r.sorted_key);
            }
            update_frontend(r.data, r.sorted_key);
        }
    );
}

function update_storage(data, sorted_key) {
    chrome.storage.local.set({
            data: data,
            sorted_key: sorted_key
        },
        function() {
            DATA_HISTORY.push(data);
            SKEY_HISTORY.push(sorted_key);
            update_frontend(data, sorted_key);
        }
    );
}

function undo() {
    if (DATA_HISTORY.length <= 1) return false;
    DATA_HISTORY.pop();
    SKEY_HISTORY.pop();
    var n = DATA_HISTORY.length;
    var data = DATA_HISTORY[n - 1];
    var skey = SKEY_HISTORY[n - 1];
    chrome.storage.local.set({
            data: data,
            sorted_key: skey
        },
        function() {
            update_frontend(data, skey);
        }
    );
}

function key_list_include(skey, k) {
    return skey.reduce(function(prev, l) {
        return prev || l.includes(k);
    }, false);
}

DEFAULT_VALUE = {
    text: '',
    has_referer: true,
    referer_url: '',
    referer_title: '',
    referer_favicon: '',
    comment: ''
};

function add_to_storage(key, value) {
    chrome.storage.local.get({
        data: {},
        sorted_key: []
    }, function(r) {
        var data = r.data;
        var skey = r.sorted_key;
        var val = $.extend({}, DEFAULT_VALUE, data[key], value);
        data[key] = val;
        if (!key_list_include(skey, key))
            if (skey.length > 0) skey[0].push(key);
            else skey.push([key]);
        update_storage(data, skey);
    });
}

function send_this_tab_to_onetab() {
    chrome.tabs.query({
        active: true
    }, function(tabs) {
        add_to_storage(tabs[0].url, {
            has_referer: false,
            text: tabs[0].title,
            referer_favicon: tabs[0].favIconUrl // borrow for favicon
        });
        chrome.tabs.remove(tabs[0].id);
    });
}

function delete_from_storage(keys) {
    chrome.storage.local.get({
        data: {},
        sorted_key: []
    }, function(r) {
        var data = r.data;
        var skey = r.sorted_key;
        keys.forEach(function(key) {
            delete data[key];
        });
        skey = skey
            .map(function(l) {
                return l.filter(function(k) {
                    return !keys.includes(k);
                });
            })
            .filter(function(l) {
                return l.length > 0;
            });
        update_storage(data, skey);
    });
}

function update_sorted_key(sorted_key) {
    chrome.storage.local.get({
        data: {},
        sorted_key: []
    }, function(r) {
        var data = r.data;
        update_storage(data, sorted_key);
    });
}

chrome.browserAction.onClicked.addListener(open_onetab);

chrome.commands.onCommand.addListener(function(command) {
    if (command == 'analyze_active_tab') chrome.tabs.query({
        active: true
    }, function(tabs) {
        analyze_tab(tabs[0]);
    });
    else if (command == 'send_this_tab_to_onetab') send_this_tab_to_onetab();
});

chrome.runtime.onConnect.addListener(function(port) {
    if (!['view', 'content'].includes(port.name)) return false;
    FRONTENDS.push(port);
    port.onMessage.addListener(function(msg) {
        if (msg.type == 'init') update_from_storage();
    });
    port.onDisconnect.addListener(function() {
        FRONTENDS = FRONTENDS.filter(function(v) {
            return v !== port;
        });
    });
    port.onMessage.addListener(function(msg) {
        if (msg.type == 'save_to_onetab') add_to_storage(msg.key, msg.value);
        else if (msg.type == 'delete_from_onetab') delete_from_storage(msg.keys);
        else if (msg.type == 'clear_all_data') update_storage({}, []);
        else if (msg.type == 'update_sorted_key') update_sorted_key(msg.sorted_key);
        else if (msg.type == 'undo_last_step') undo();
        else if (msg.type == 'analyze_tab') analyze_tab(msg.tab);
    });
});
