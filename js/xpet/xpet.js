/* global XPET, Class, Victor, Motio, Matter */
/* jshint forin: false, bitwise: false */


// Initial checks, this is a module loading hack. The reason is that my
// enviroment differs from the standard setting, so it needs to supply the data
// via other means.
//
// By other means, I mean by hacking module references onto the XPET namespace.
(function() {
    console.assert(window.XPET !== undefined);

    // Detect underscore
    if (!("underscore" in XPET) && _ && _.VERSION) { XPET.underscore = _; }

    // Detect class
    if (!("Class" in XPET) && Class && Class.extend) { XPET.Class = Class; }

    console.assert("underscore" in XPET);
    console.assert("Class" in XPET); // Resig Class
    console.assert(window.jQuery);
})();

// Game module
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('game');
    var Class = XPET.require('Class');

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
            this.now = timestamp();
        },

        height: function() {
            return this.el.height();
        },

        width: function() {
            return this.el.width();
        },

        loop: function() {
            var UPDATES_PER_SECOND = 60;
            var now, dt = 0, last = timestamp(),
                step = 1000/UPDATES_PER_SECOND;

            var self = this;
            function frame() {
                now = self.now = timestamp();
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
            delete this.renderables[id];
        }
    });

    return exports;
})();

// Sprites
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('sprite');
    var Class = XPET.require('Class');

    var ANIMATION_SETTINGS = {
        "corgi-walk-left": {
            css_class: "xpet-anim-corgi-walk",
            frames: 4,
            flip: true
        },
        "corgi-walk-right": {
            css_class: "xpet-anim-corgi-walk",
            frames: 4
        },
        "corgi-stand-left": {
            css_class: "xpet-anim-corgi-stand",
            frames: 2,
            fps: 2,
            flip: true
        },
        "corgi-stand-right": {
            css_class: "xpet-anim-corgi-stand",
            frames: 2,
            fps: 2
        },
        "corgi-run-left": {
            css_class: "xpet-anim-corgi-run",
            frames: 2,
            flip: true
        },
        "corgi-run-right": {
            css_class: "xpet-anim-corgi-run",
            frames: 2
        },
        "corgi-sit": {
            css_class: "xpet-anim-corgi-sit",
            frames: 4,
            fps: 5
        }
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
                "class": "xpet-sprite"
            }).css({
                width: this.width,
                height: this.height
            }).on('dragstart', function(ev) { ev.preventDefault(); });

            this.sprite_el = jQuery('<div>', {
                "class": this.css_class
            }).appendTo(this.el);
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

            this.anim = anim;
            if (this.motio) { this.motio.destroy(); }

            console.assert(anim in ANIMATION_SETTINGS);
            var settings = ANIMATION_SETTINGS[anim];

            this.sprite_el.removeClass();
            this.sprite_el.addClass(settings.css_class);
            this.sprite_el.css("scaleX", settings.flip ? -1 : 1);

            var motio_options = {
                vertical: true,
                width: this.width,
                height: this.height,
                fps: settings.fps || 15,
                frames: settings.frames
            };

            this.motio = new Motio(this.sprite_el[0], motio_options);
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

    /**
     * @param {jQuery.element} game_el      The game world element
     */
    exports.start = function(game_el) {
        var game = exports.game = new xpet_game.Game({
            el: jQuery(game_el)
        });
        game_el.addClass('xpet-gameworld');
        dog.setup_dog(game);
        game.start();
    };
    return exports;
})();

// Dog
// ---------------------------------------------------------------------------
(function() {
    var exports = XPET.namespace('dog');
    var sprite = XPET.namespace('sprite');
    var input = XPET.namespace('input');
    var Class = XPET.require('Class');
    var _ = XPET.require('underscore');

    var PHYSICS_MOUSE = 0x002;
    var PHYSICS_THROWABLE = 0x004;
    var PHYSICS_WALL = 0x008;

    var Dog = Class.extend({
        SPEED: 300, // per second

        init: function(options) {
            this.pos = new Victor(options.x, options.y);
            this.velocity = new Victor(0, 0);
            this.width = 140;
            this.height = 100;
            this.facing_right = true;
            this.chasing = false;

            this.sprite = new sprite.Sprite({
                width: this.width,
                height: this.height
            });
        },

        go_to_pos: function(dest, dist) {
            var speed = this.SPEED;
            if (this.pos.distanceSq(dest) < (dist * dist)) {
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
                this.facing_right = true;
            } else if (this.velocity.x < -1) {
                this.facing_right = false;
            }

            if (this.chasing) {
                this.sprite.set_animation(
                    this.facing_right ? "corgi-walk-right" : "corgi-walk-left");
            } else {
                this.sprite.set_animation("corgi-sit");
            }

            this.sprite.pos.x = this.pos.x;
            this.sprite.pos.y = this.pos.y;
        }
    });

    /**
     * Base class for entities represented by a single physics body
     */
    var PhysicsEntity = Class.extend({
        init: function(options) {
            this.physics_body = this.create_physics_body();

            // Hack an XPET entity reference on here
            this.physics_body.XPET = this;
        },

        create_physics_body: function() {
            throw new Error("implement me");
        },

        physics_sleep: function() {
            Matter.Sleeping.set(this.physics_body, true);
        },

        /**
         * Called if the physics entity is dragged (this only happens if your
         * body has a collisionFilter mask containing PHYSICS_MOUSE)
         */
        on_start_drag: function() {
            this.dragging = true;
        },

        /**
         * Called if the physics entity is dragged (this only happens if your
         * body has a collisionFilter mask containing PHYSICS_MOUSE)
         */
        on_end_drag: function() {
            this.dragging = false;
            this.throw_time = this.game.now;
        }
    });

    var Ball = PhysicsEntity.extend({
        init: function(options) {
            this.pos = new Victor(options.x, options.y);
            this.angle = 0;
            this.game = options.game;
            this.throw_time = this.game.now;
            this.dragging = false;

            // Diameter
            this.diameter = options.diameter;
            this.sprite = new sprite.Image({
                width: this.diameter,
                height: this.diameter,
                css_class: "xpet-ball"
            });

            this._super(options);
        },

        create_physics_body: function() {
            return Matter.Bodies.circle(
                this.pos.x, this.pos.y, this.diameter / 2, {
                    restitution: 0.8,
                    label: "Ball",
                    collisionFilter: {
                        category: PHYSICS_THROWABLE,
                        mask: PHYSICS_WALL | PHYSICS_MOUSE
                    }
                });
        },

        update: function() {
            // Read position from physics body
            this.pos.x = this.physics_body.position.x;
            this.pos.y = this.physics_body.position.y;
            this.angle = this.physics_body.angle;

            this.sprite.pos.x = this.pos.x;
            this.sprite.pos.y = this.pos.y;
            this.sprite.angle = this.angle;
        },

        on_start_drag: function() {
            this.dragging = true;
        },

        on_end_drag: function() {
            this.dragging = false;
            this.throw_time = this.game.now;
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
            this.ball = new Ball({
                x: 200, y: 100, diameter: 25, game: this.game});
            Matter.Body.applyForce(this.ball.physics_body,
                {x: 0, y: 400}, {x: 0.01, y: -0.01});

            this.game.register_updatable(this);

            // We store our own updatables
            this.to_update = [this.dog, this.ball];

            var sprites = [this.dog.sprite, this.ball.sprite];

            _.each(sprites, function(s) {
                this.game.register_renderable(s);
            }, this);

            Matter.World.add(this.physics_engine.world, this.ball.physics_body);

            this.set_dog_mode("fetching", {target: this.ball});
        },

        set_dog_mode: function(mode, data) {
            this.dog_mode = mode;
            this.dog_mode_data = data;
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
            var mouse = Matter.Mouse.create(this.game.el[0]);
            this.physics_mouse_constraint = Matter.MouseConstraint.create(
                this.physics_engine, {
                    mouse: mouse,
                    collisionFilter: {
                        category: PHYSICS_MOUSE,
                        mask: PHYSICS_THROWABLE
                    },
                    constraint: Matter.Constraint.create({
                        label: 'Mouse Constraint',
                        pointA: mouse.position,
                        pointB: { x: 0, y: 0 },
                        length: 0.01,
                        stiffness: 0.7,
                        angularStiffness: 1
                    })
                });

            Matter.Events.on(this.physics_mouse_constraint, 'startdrag',
                _.bind(function(event) {
                    var xpet_object = event.body.XPET;
                    if (xpet_object) { xpet_object.on_start_drag(); }
                }));


            Matter.Events.on(this.physics_mouse_constraint, 'enddrag',
                _.bind(function(event) {
                    var xpet_object = event.body.XPET;
                    if (xpet_object) { xpet_object.on_end_drag(); }
                }));

            var world = this.physics_engine.world;
            var game_width = this.game.width();
            var game_height = this.game.height();
            
            // Extending beyond the div
            var bounds_offset = 200;

            world.bounds.min.x = -bounds_offset;
            world.bounds.min.y = -bounds_offset;
            world.bounds.max.x = game_width + bounds_offset;
            world.bounds.max.y = game_height + bounds_offset;

            // Create walls
            var inset = 5;
            var extra = 50;
            var thickness = 100;
            var half_thickness = thickness / 2;
            var half_game_width = game_width / 2;
            var half_game_height = game_height / 2;
            var r = Matter.Bodies.rectangle;

            var common_options = {
                isStatic: true,
                collisionFilter: {
                    category: PHYSICS_WALL,
                    mask:  PHYSICS_THROWABLE
                }
            };

            var roof = r(half_game_width, inset-half_thickness,
                game_width + extra, thickness, _.defaults({
                    label: "Roof"
                }, common_options));

            var floor = r(half_game_width, game_height+half_thickness-inset,
                game_width + extra, thickness, _.defaults({
                    isStatic: true,
                    label: "Floor"
                }, common_options));

            var left_wall = r(inset-half_thickness, half_game_height,
                thickness, game_height + extra, _.defaults({
                    isStatic: true,
                    label: "Left Wall"
                }, common_options));

            var right_wall = r(game_width+half_thickness-inset,
                half_game_height, thickness, game_height + extra, _.defaults({
                    isStatic: true,
                    label: "Right Wall"
                }, common_options));

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
            this.physics_update(dt);

            this.game_update(dt);

            _.each(this.to_update, function(entity) {
                entity.update(dt);
            }, this);
        },

        game_update: function() {

            switch (this.dog_mode) {
                case "fetching":
                    this.dog_mode_fetching(this.dog_mode_data);
            }

        },

        dog_mode_fetching: function(data) {
            var target = data.target;
            if (target.pos) {
                var required_distance = 20;
                var in_range = (target.pos.distanceSq(this.dog.pos) <
                    (required_distance * required_distance));
                
                var throw_time = this.game.now - target.throw_time;

                var still_throwing = throw_time < 2000;

                this.dog.chasing = false;
                if (target.dragging) {
                    this.dog.stop();
                } else if (!(still_throwing) && in_range) {
                    this.ball.physics_sleep();
                    this.dog.stop();
                } else {
                    this.dog.chasing = true;
                    this.dog.go_to_pos(target.pos, required_distance / 2);
                }

            } else {
                this.dog.stop();
            }
        },

        physics_update: function(dt) {
            // SUPER MEGA HACK FOR MATTER MOUSE HANDLING (see
            // _getRelativeMousePosition)
            var el = this.game.el[0];
            el.width = el.clientWidth;
            el.height = el.clientHeight;

            var event = {
                timestamp: this.game.now
            };
            Matter.Events.trigger(this.physics_engine, 'beforeTick', event);
            Matter.Events.trigger(this.physics_engine, 'tick', event);
            Matter.Engine.update(this.physics_engine, dt, 1);
        }
    });

    exports.setup_dog = function(game) {
        new DogGameLogic({game: game});
    };
})();
