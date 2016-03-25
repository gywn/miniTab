function analyze_tab(t) {
    chrome.tabs.executeScript(t.id, {code: 'typeof ONETAB_INJECTED == "undefined";'},
        function(r) {
            if (r[0]) {
                chrome.tabs.executeScript(t.id, {file: 'jquery-2.0.3.min.js', runAt: 'document_end'});
                chrome.tabs.executeScript(t.id, {file: 'content.js', runAt: 'document_end'});
            }
            chrome.tabs.executeScript(t.id, {file: 'content-toggle.js'});
        }
    );
}

function open_onetab() {
    chrome.tabs.create({url: chrome.extension.getURL('view.html')});
}

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
    chrome.storage.local.get({data: {}, key_list: []},
        function(r) {
            if (HISTORY.length === 0) HISTORY.push(r);
            update_frontend(r.data, r.key_list);
        }
    );
}

function update_storage(data, keyl) {
    var r = {data: data, key_list: keyl};
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

DEFAULT_VALUE = {
    text: '',
    has_referer: true,
    referer_url: '',
    referer_title: '',
    referer_favicon: '',
    comment: ''
};

function add_to_storage(key, value) {
    chrome.storage.local.get({data: {}, key_list: []}, function(r) {
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

function send_this_tab_to_onetab() {
    chrome.tabs.query({active: true}, function(tabs) {
        add_to_storage(tabs[0].url, {
            has_referer: false,
            text: tabs[0].title,
            referer_favicon: tabs[0].favIconUrl // borrow for favicon
        });
        chrome.tabs.remove(tabs[0].id);
    });
}

function delete_from_storage(keys) {
    chrome.storage.local.get({data: {}, key_list: []}, function(r) {
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
    else chrome.storage.local.get({data: {}, key_list: []}, function(r) {
        var data = r.data;
        update_storage(data, keyl);
    });
}

chrome.browserAction.onClicked.addListener(open_onetab);

chrome.commands.onCommand.addListener(function(command) {
    if (command == 'analyze-active-tab')
        chrome.tabs.query({active: true}, function(tabs) {analyze_tab(tabs[0]);});
    else if (command == 'insert-active-tab') send_this_tab_to_onetab();
});

chrome.runtime.onConnect.addListener(function(port) {
    if (!['view', 'content'].includes(port.name)) return false;
    FRONTENDS.push(port);
    port.onMessage.addListener(function(msg) {
        if (msg.type == 'init') update_from_storage();
        if (msg.type == 'insert-record') add_to_storage(msg.key, msg.value);
        else if (msg.type == 'delete-records') delete_from_storage(msg.keys);
        else if (msg.type == 'truncate-all') update_storage({}, []);
        else if (msg.type == 'update-url-list') update_key_list(msg.key_list);
        else if (msg.type == 'undo-one-step') undo();
        else if (msg.type == 'analyze-tab') analyze_tab(msg.tab);
    });
    port.onDisconnect.addListener(function() {
        FRONTENDS = FRONTENDS.filter(function(v) {return v !== port;});
    });
});