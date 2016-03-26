HIGHLIGHTED = !HIGHLIGHTED;

if (HIGHLIGHTED) {
    PORT.postMessage({type: 'init'});
} else
    update_overlays();
