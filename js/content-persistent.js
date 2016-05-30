(function() {
    document.addEventListener('mousedown', function(e) {
        if (e.button === 2) {
            var elem = e.target;
            while (elem) {
                if (elem instanceof HTMLAnchorElement) {
                    var url = elem.href;
                    var text = elem.innerText;

                    if (!text || text === '') text = url;
                    window.chrome.runtime.sendMessage({
                        type: 'cache-right-click-info',
                        key: url,
                        value: {text: text}
                    });
                    break;
                } else
                    elem = elem.parentNode;
            }
        }
    }, true);
})();
