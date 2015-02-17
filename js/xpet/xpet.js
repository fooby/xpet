/* global XPET, Class */
/* jshint forin: false */

// Namespace module
// ---------------------------------------------------------------------------
(function() {
    var XPET = window.XPET = {};

    /**
     * Namespace
     */
    XPET.namespace = function (namespace) {
        var nsparts = namespace.split(".");
        if (nsparts[0] === "XPET") { nsparts = nsparts.slice(1); }
        var parent = XPET;
        for (var i = 0; i < nsparts.length; i++) {
            var partname = nsparts[i];
            if (parent[partname] === undefined) { parent[partname] = {}; }
            parent = parent[partname];
        }
        return parent;
    };

    XPET.require = XPET.namespace;
})();

// Game module
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('game');

    var timestamp = function() {
        return window.performance && window.performance.now ?
            window.performance.now() : new Date().getTime();
    };
    
    exports.Game = Class.extend({
        init: function(options) {
            this.elem = options.elem;
            this.renderables = {};
            this.updateables = {};
        },

        loop: function() {
            var UPDATES_PER_SECOND = 30;
            var now, dt = 0, last = timestamp(),
                step = 1000/UPDATES_PER_SECOND;

            function frame() {
                now = timestamp();
                dt = dt + Math.min(1, (now - last));
                while(dt > step) {
                    dt = dt - step;
                    this.update(step);
                }
                this.render(dt);
                last = now;
                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        },

        render: function() { for (var r in this.renderables) { r.render(); } },

        update: function() { for (var u in this.updateables) { u.update(); } },

        register_renderable: function(obj) {
            obj.set_game(this);
            this.renderables[obj.id] = obj;
        },

        unregister_renderable: function(id) { delete this.renderables[id]; },

        register_updateable: function(obj) {
            obj.set_game(this);
            this.updateables[obj.id] = obj;
        },

        unregister_updateable: function(id) { delete this.renderables[id]; }
    });

    return exports;
})();


// Main module
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('main');

    var xpet_game = XPET.require('game');

    exports.start = function() {
        var game = exports.game = new xpet_game.Game({
            elem: $("#gameworld")
        });
        game.start();
    };
    return exports;
})();
