// Namespace module
//
// TODO: Ditch this and use a proper javascript module loader

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
