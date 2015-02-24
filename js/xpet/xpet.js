/* global XPET, Class, Victor, Motio, Matter */
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
            this.el = options.el;
            this.renderables = {};
            this.updatable = {};

            this.id_counter = 0;
        },

        loop: function() {
            var UPDATES_PER_SECOND = 60;
            var now, dt = 0, last = timestamp(),
                step = 1000/UPDATES_PER_SECOND;

            var self = this;
            function frame() {
                now = timestamp();
                dt = dt + Math.min(1000, (now - last));

                while(dt > step) {
                    dt = dt - step;
                    self.update(step);
                }
                self.render(dt);
                last = now;
                requestAnimationFrame(frame);
            }

            requestAnimationFrame(frame);
        },

        render: function(dt) {
            for (var r in this.renderables) {
                this.renderables[r].render(dt);
            }
        },

        update: function(dt) {
            for (var u in this.updatable) {
                this.updatable[u].update(dt);
            }
        },

        start: function() { this.loop(); },

        make_id: function() {
            return this.id_counter++;
        },

        register_renderable: function(obj) {
            var id = this.make_id();
            obj.game_id = id;
            this.el.append(obj.el);
            this.renderables[id] = obj;
        },

        unregister_renderable: function(obj) {
            var id = obj.game_id;
            var renderable = this.renderables[id];
            renderable.el.remove();
            delete this.renderables[id];
        },

        register_updatable: function(obj) {
            var id = this.make_id();
            obj.game_id = id;
            this.updatable[obj.game_id] = obj;
        },

        unregister_updatable: function(obj) {
            var id = obj.game_id;
            delete this.renderables[obj.game_id];
        }
    });

    return exports;
})();

// Sprites
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('sprite');

    var ANIMATION_DEFAULTS = {
        "sprite-corgi-walk-left": { width: 100, height: 100, frames: 4 },
        "sprite-corgi-walk-right": { width: 100, height: 100, frames: 4 },
        "sprite-corgi-stand-left": { width: 100, height: 100, frames: 2, fps: 2 },
        "sprite-corgi-stand-right": { width: 100, height: 100, frames: 2, fps: 2 }
    };

    exports.Image = Class.extend({
        init: function(options) {
            this.pos = options.pos || new Victor(0, 0);
            this.width = options.width;
            this.height = options.height;
            this.angle = options.angle || 0;
            this.css_class = options.css_class;
            this.create();
        },

        create: function() {
            this.el = jQuery('<div>', {
                "class": this.css_class
            }).css({
                width: this.width,
                height: this.height
            });
        },

        calc_pos: function() {
            return this.pos;
        },

        render: function() {
            var pos = this.calc_pos();
            if (pos) {
                var x = pos.x - this.width / 2;
                var y = pos.y - this.height / 2;

                this.el.css({
                    x: x + 'px',
                    y: y + 'px',
                    rotate: this.angle + 'rad'
                });
            }
        }
    });

    exports.Sprite = exports.Image.extend({
        init: function(options) {
            this._super(options);
            this.anim = null;
            this.motio = null;
        },

        set_animation: function(anim) {
            if (this.anim === anim) { return; }
            if (this.motio) { this.motio.destroy(); }

            this.el.removeClass();
            this.el.addClass("sprite " + anim);
            console.assert(anim in ANIMATION_DEFAULTS);
            var defaults = ANIMATION_DEFAULTS[anim];
            this.anim = anim;
            this.motio = new Motio(this.el[0], _.defaults({
                vertical: true
            }, defaults));
            this.motio.play();
        }
    });

    //exports.MovingSprite = exports.Sprite.extend({
    //    init: function(options) {
    //        this._super(options);
    //        this.velocity = options.velocity;
    //    }
    //});

})();

// Input
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('input');
    var mouse = {x: 0, y: 0};
    exports.get_mouse_pos = function() { return mouse; };
    document.addEventListener('mousemove', function(e){ 
        mouse.x = e.clientX || e.pageX; 
        mouse.y = e.clientY || e.pageY;
    }, false);

})();

// Main module
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('main');

    var xpet_game = XPET.require('game');
    var dog = XPET.require('dog');

    exports.start = function() {
        var game = exports.game = new xpet_game.Game({
            el: $("#gameworld")
        });
        dog.setup_dog(game);
        game.start();
    };
    return exports;
})();

// Dog
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('dog');
    var pos = XPET.namespace('position');
    var sprite = XPET.namespace('sprite');
    var input = XPET.namespace('input');

    var PHYSICS_MOUSE = 0x002;
    var PHYSICS_THROWABLE = 0x004;
    var PHYSICS_WALL = 0x008;

    var Dog = Class.extend({
        SPEED: 300, // per second

        init: function(options) {
            this.pos = new Victor(options.x, options.y);
            this.velocity = new Victor(0, 0);
            this.acceleration = new Victor(0, 0);
            this.width = 100;
            this.height = 100;
            this.facing_right = true;

            this.sprite = new sprite.Sprite({
                width: this.width,
                height: this.height
            });
        },

        go_to_pos: function(dest) {
            var speed = this.SPEED;

            if (this.pos.distanceSq(dest) < 5000) {
                this.stop();
            } else {
                this.velocity = dest.clone().subtract(this.pos).normalize()
                    .multiply({x: speed, y: speed});
            }
        },

        stop: function() {
            this.velocity.x = 0;
            this.velocity.y = 0;
        },

        /**
         * @param {int} dt      milliseconds since last  update
         */
        update: function(dt) {
            var ratio = dt / 1000;
            var changeX = this.velocity.x * ratio;
            var changeY = this.velocity.y * ratio;
            this.pos.add({x: changeX, y: changeY});

            if (this.velocity.x > 1) {
                this.sprite.set_animation("sprite-corgi-walk-right");
                this.facing_right = true;
            } else if (this.velocity.x < -1) {
                this.sprite.set_animation("sprite-corgi-walk-left");
                this.facing_right = false;
            } else {
                this.sprite.set_animation(this.facing_right ?
                    "sprite-corgi-stand-right": "sprite-corgi-stand-left");
            }

            this.sprite.pos.x = this.pos.x;
            this.sprite.pos.y = this.pos.y;
        }
    });

    var Ball = Class.extend({
        init: function(options) {
            this.pos = new Victor(options.x, options.y);
            this.angle = 0;

            // Diameter
            this.diameter = options.diameter;
            this.sprite = new sprite.Image({
                width: this.diameter,
                height: this.diameter,
                css_class: "ball"
            });

            this.physics_body = Matter.Bodies.circle(
                this.pos.x, this.pos.y, this.diameter / 2, {
                    restitution: 0.9,
                    //collisionFilter: {
                    //    category: PHYSICS_THROWABLE,
                    //    mask: PHYSICS_WALL | PHYSICS_MOUSE
                    //}
                });
        },

        update: function() {
            // Read position from matter
            this.pos.x = this.physics_body.position.x;
            this.pos.y = this.physics_body.position.y;
            this.angle = this.physics_body.angle;

            this.sprite.pos.x = this.pos.x;
            this.sprite.pos.y = this.pos.y;
            this.sprite.angle = this.angle;
        }
    });

    /**
     * This is effectively the game logic
     */
    var DogGameLogic = Class.extend({
        init: function(options) {
            this.game = options.game;
            this.setup_physics();
            this.dog = new Dog({x: 100, y: 50});
            this.ball = new Ball({x: 200, y: 300, diameter: 25});

            this.game.register_updatable(this);

            // We store our own updatables
            this.to_update = [this.dog, this.ball];

            var sprites = [this.dog.sprite, this.ball.sprite];

            _.each(sprites, function(s) {
                this.game.register_renderable(s);
            }, this);

            Matter.World.add(this.physics_engine.world, this.ball.physics_body);
        },

        setup_physics: function() {
            this.physics_engine = Matter.Engine.create(this.game.el[0], {
                render: {
                    controller: {
                        create: function() {},
                        clear: function() {},
                        world: function() {}
                    }
                }
            });

            // Create mouse constraint
            this.physics_mouse_constraint = Matter.MouseConstraint.create(
                this.physics_engine, {
                    mouse: Matter.Mouse.create(this.game.el[0]),
                    //collisionFilter: {
                    //    category: PHYSICS_MOUSE,
                    //    mask: PHYSICS_THROWABLE
                    //}
                });

            var world = this.physics_engine.world;
            var game_width = this.game.el.width();
            var game_height = this.game.el.height();
            
            // Extending beyond the div
            var bounds_offset = 100;

            world.bounds.min.x = -bounds_offset;
            world.bounds.min.y = -bounds_offset;
            world.bounds.max.x = game_width + bounds_offset;
            world.bounds.max.y = game_height + bounds_offset;

            // Create walls
            var inset = 5;
            var extra = 10;
            var thickness = 50;
            var half_thickness = thickness / 2;
            var half_game_width = game_width / 2;
            var half_game_height = game_height / 2;
            var r = Matter.Bodies.rectangle;

            var roof = r(half_game_width, inset-half_thickness,
                         game_width + extra, thickness, { isStatic: true });

            var floor = r(half_game_width, game_height+half_thickness-inset,
                          game_width + extra, thickness, { isStatic: true });

            var left_wall = r(inset-half_thickness, half_game_height,
                              game_height + extra, thickness,
                              { isStatic: true });

            var right_wall = r(game_width+half_thickness-inset,
                               half_game_height,
                               game_height + extra, thickness,
                               { isStatic: true });

            Matter.World.add(world, [
                roof, floor, left_wall, right_wall,
                this.physics_mouse_constraint
            ]);
        },

        get_mouse_pos: function() {
            var mouse = input.get_mouse_pos();
            var el = this.game.el;
            var offset = el.offset();
            var relX = mouse.x - offset.left;
            var relY = mouse.y - offset.top;
            if (relX >= 0 && relY >= 0 && relX <= el.width() &&
                    relY < el.height()) {
                return new Victor(relX, relY);
            } else {
                return null;
            }
        },

        update: function(dt) {
            Matter.Engine.update(this.physics_engine, dt, 1);

            var mouse_pos = this.get_mouse_pos();
            if (mouse_pos) {
                this.dog.go_to_pos(mouse_pos);
            } else {
                this.dog.stop();
            }

            _.each(this.to_update, function(entity) {
                entity.update(dt);
            }, this);
        }
    });

    exports.setup_dog = function(game) {
        var dog = new DogGameLogic({game: game});
    };
})();
