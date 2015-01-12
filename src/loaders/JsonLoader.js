var core = require('../core'),
    spine = require('../spine/SpineRuntime'),
    ImageLoader = require('./ImageLoader'),
    SpineTextureLoader = require('./SpineTextureLoader');

/**
 * The json file loader is used to load in JSON data and parse it
 * When loaded this class will dispatch a 'loaded' event
 * If loading fails this class will dispatch an 'error' event
 *
 * @class
 * @mixes eventTarget
 * @namespace PIXI
 * @param url {String} The url of the JSON file
 * @param crossorigin {boolean} Whether requests should be treated as crossorigin
 */
function JsonLoader(url, crossorigin)
{
    /**
     * The url of the bitmap font data
     *
     * @member {String}
     */
    this.url = url;

    /**
     * Whether the requests should be treated as cross origin
     *
     * @member {boolean}
     */
    this.crossorigin = crossorigin;

    /**
     * The base url of the bitmap font data
     *
     * @member {String}
     * @readOnly
     */
    this.baseUrl = url.replace(/[^\/]*$/, '');

    /**
     * Whether the data has loaded yet
     *
     * @member {boolean}
     * @readOnly
     */
     this.loaded = false;
}

// constructor
JsonLoader.prototype.constructor = JsonLoader;
module.exports = JsonLoader;

core.utils.eventTarget.mixin(JsonLoader.prototype);

/**
 * Loads the JSON data
 *
 */
JsonLoader.prototype.load = function ()
{
    if (window.XDomainRequest && this.crossorigin)
    {
        this.ajaxRequest = new window.XDomainRequest();

        // XDomainRequest has a few quirks. Occasionally it will abort requests
        // A way to avoid this is to make sure ALL callbacks are set even if not used
        // More info here: http://stackoverflow.com/questions/15786966/xdomainrequest-aborts-post-on-ie-9
        this.ajaxRequest.timeout = 3000;

        this.ajaxRequest.onerror = this.onError.bind(this);
        this.ajaxRequest.ontimeout = this.onError.bind(this);

        this.ajaxRequest.onprogress = function ()
        {};

        this.ajaxRequest.onload = this.onJSONLoaded.bind(this);
    }
    else
    {
        if (window.XMLHttpRequest)
        {
            this.ajaxRequest = new window.XMLHttpRequest();
        }
        else
        {
            this.ajaxRequest = new window.ActiveXObject('Microsoft.XMLHTTP');
        }

        this.ajaxRequest.onreadystatechange = this.onReadyStateChanged.bind(this);
    }

    this.ajaxRequest.open('GET',this.url,true);

    this.ajaxRequest.send();
};

/**
 * Bridge function to be able to use the more reliable onreadystatechange in XMLHttpRequest.
 *
 * @private
 */
JsonLoader.prototype.onReadyStateChanged = function ()
{
    if (this.ajaxRequest.readyState === 4 && (this.ajaxRequest.status === 200 || window.location.href.indexOf('http') === -1))
    {
        this.onJSONLoaded();
    }
};

/**
 * Invoke when JSON file is loaded
 *
 * @private
 */
JsonLoader.prototype.onJSONLoaded = function ()
{
    if (!this.ajaxRequest.responseText)
    {
        this.onError();
        return;
    }

    this.json = JSON.parse(this.ajaxRequest.responseText);

    if (this.json.frames)
    {
        // sprite sheet
        var textureUrl = this.baseUrl + this.json.meta.image;
        var image = new ImageLoader(textureUrl, this.crossorigin);
        var frameData = this.json.frames;

        this.texture = image.texture.baseTexture;
        image.addEventListener('loaded', this.onLoaded.bind(this));
        image.addEventListener('error', this.onError.bind(this));

        for (var i in frameData)
        {
            var rect = frameData[i].frame;

            if (rect)
            {
                var textureSize = new core.math.Rectangle(rect.x, rect.y, rect.w, rect.h);
                var crop = textureSize.clone();
                var trim = null;

                //  Check to see if the sprite is trimmed
                if (frameData[i].trimmed)
                {
                    var actualSize = frameData[i].sourceSize;
                    var realSize = frameData[i].spriteSourceSize;
                    trim = new core.math.Rectangle(realSize.x, realSize.y, actualSize.w, actualSize.h);
                }
                core.utils.TextureCache[i] = new core.Texture(this.texture, textureSize, crop, trim);
            }
        }

        image.load();

    }
    else if (this.json.bones)
    {
		// check if the json was loaded before
        if (core.utils.AnimCache[this.url])
        {
			this.onLoaded();
		}
        else
        {
			/**
             * use a bit of hackery to load the atlas file, here we assume that the .json, .atlas and .png files
			 * that correspond to the spine file are in the same base URL and that the .json and .atlas files
			 * have the same name
			 */
			var atlasPath = this.url.substr(0, this.url.lastIndexOf('.')) + '.atlas';
			var atlasLoader = new JsonLoader(atlasPath, this.crossorigin);
			// save a copy of the current object for future reference //
			var originalLoader = this;
			// before loading the file, replace the "onJSONLoaded" function for our own //
            atlasLoader.onJSONLoaded = function ()
            {
				// at this point "this" points at the atlasLoader (JsonLoader) instance //
                if (!this.ajaxRequest.responseText)
                {
					this.onError(); // FIXME: hmm, this is funny because we are not responding to errors yet
					return;
				}
				// create a new instance of a spine texture loader for this spine object //
				var textureLoader = new SpineTextureLoader(this.url.substring(0, this.url.lastIndexOf('/')));
				// create a spine atlas using the loaded text and a spine texture loader instance //
				var spineAtlas = new spine.Atlas(this.ajaxRequest.responseText, textureLoader);
				// now we use an atlas attachment loader //
				var attachmentLoader = new spine.AtlasAttachmentLoader(spineAtlas);
				// spine animation
				var spineJsonParser = new spine.SkeletonJson(attachmentLoader);
				var skeletonData = spineJsonParser.readSkeletonData(originalLoader.json);
				core.utils.AnimCache[originalLoader.url] = skeletonData;
				originalLoader.spine = skeletonData;
				originalLoader.spineAtlas = spineAtlas;
				originalLoader.spineAtlasLoader = atlasLoader;
				// wait for textures to finish loading if needed
                if (textureLoader.loadingCount > 0)
                {
                    textureLoader.addEventListener('loadedBaseTexture', function (evt)
                    {
                        if (evt.content.content.loadingCount <= 0)
                        {
							originalLoader.onLoaded();
						}
					});
				}
                else
                {
					originalLoader.onLoaded();
				}
			};
			// start the loading //
			atlasLoader.load();
		}
    }
    else
    {
        this.onLoaded();
    }
};

/**
 * Invoke when json file loaded
 *
 * @private
 */
JsonLoader.prototype.onLoaded = function ()
{
    this.loaded = true;
    this.dispatchEvent({
        type: 'loaded',
        content: this
    });
};

/**
 * Invoke when error occured
 *
 * @private
 */
JsonLoader.prototype.onError = function ()
{

    this.dispatchEvent({
        type: 'error',
        content: this
    });
};
