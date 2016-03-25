HIGHLIGHTED = !HIGHLIGHTED;

if (HIGHLIGHTED) {
    $('.link-overlay').show();
    PORT.postMessage({
        type: 'init'
    });
} else {
    $('.link-overlay').hide();
}
