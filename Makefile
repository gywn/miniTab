JS  = background.js content-persistent.js content-toggle.js content.js view.js
CSS = content.css view.css
IMG = globe.svg handler.svg sprite.svg
LIB = jquery-2.0.3.min.js jquery-ui.min.js

DIST = dist

all: clear copy-files compress

clear: 
	if [ -d $(DIST) ]; then rm -r $(DIST); fi

copy-files:
	mkdir $(DIST)
	(cd $(DIST); mkdir js css images lib)
	cp $(JS:%=js/%) $(DIST)/js
	cp $(CSS:%=css/%) $(DIST)/css
	cp $(IMG:%=images/%) $(DIST)/images
	cp $(LIB:%=lib/%) $(DIST)/lib
	cp view.html $(DIST)
	for i in 19 38 16 48 128; do \
	  convert -background none -resize $${i}x-1 -unsharp 1.5x1+0.3 images/icon.svg $(DIST)/images/icon-$${i}.png; \
	done
	cp manifest.json $(DIST)

compress:
	rm -f $(DIST).zip
	zip -r $(DIST).zip $(DIST)/*
