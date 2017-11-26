/**
 * Incremental Delaunay Triangulation
 *
 * @author Pratith Kanagaraj <pxk5958@rit.edu>, 2017
 */

/* global PIXI */
/* global THREE */


var incrementalDelaunay = function() {

const EPSILON = 1e-6;
const RENDER_WIDTH = 720;
const RENDER_HEIGHT = 720;

var backgroundColor = 0xFFFFFF;
var pointColor = 0x000000;
var pointRadius = 5;
var triangleEdgeWidth = 2;
var triangleEdgeColor = 0x5D6D7E;
var voronoiEdgeWidth = 2;
var voronoiEdgeColor = 0xD35400;
var voronoiCircleWidth = 1;
var voronoiCircleColor = 0xE5E8E8;
var pointGraphics = [];

var renderer, stage, lineGraphics;
var points = [];
var mesh;
var timestamp = 0;

var drawDT = true;
var drawVD = true;
var drawVoronoiCircles = true;
var drawSteps = true;

class Line {
	constructor(p, q) {
		var t = new THREE.Vector2(q.x - p.x, q.y - p.y);
		var len = t.length();
		this.a = t.y / len;
		this.b = -t.x / len;
		this.c = -(this.a*p.x + this.b*p.y);
	}
	
	eval(p) {
		return (this.a*p.x + this.b*p.y + this.c);
	}
	
	classify(p) {
		var d = this.eval(p);
		return (d < -EPSILON) ? -1 : (d > EPSILON ? 1 : 0);
	}
}


class Edge {
	constructor() {
		this.data = null;
		this.next = null;
		this.num = -1;
		this.qEdge = null;
	}
	
	rot() {
		return (this.num < 3) ? this.qEdge.e[this.num + 1] : this.qEdge.e[this.num - 3];
	}
	
	invRot() {
		return (this.num > 0) ? this.qEdge.e[this.num - 1] : this.qEdge.e[this.num + 3];
	}
	
	sym() {
		return (this.num < 2) ? this.qEdge.e[this.num + 2] : this.qEdge.e[this.num - 2];
	}
	
	onext() {
		return this.next;
	}
	
	oprev() {
		return this.rot().onext().rot();
	}
	
	dnext() {
		return this.sym().onext().sym();
	}
	
	dprev() {
		return this.invRot().onext().invRot();
	}
	
	lnext() {
		return this.invRot().onext().rot();
	}
	
	lprev() {
		return this.onext().sym();
	}
	
	rnext() {
		return this.rot().onext().invRot();
	}
	
	rprev() {
		return this.sym().onext();
	}
	
	org() {
		return this.data;
	}
	
	dest() {
		return this.sym().data;
	}
	
	org2d() {
		return this.data;
	}
	
	dest2d() {
		return (this.num < 2) ? this.qEdge.e[this.num + 2].data : this.qEdge.e[this.num - 2].data;
	}
	
	endPoints(or, de) {
		this.data = or;
		this.sym().data = de;
	}
	
	draw(stamp) {
		if (this.qEdge.timeStamp(stamp)) {
			var a = this.org2d();
			var b = this.dest2d();
			
			if (drawDT) {
				lineGraphics.lineStyle(triangleEdgeWidth, triangleEdgeColor);
				lineGraphics.moveTo(a.x, a.y);
				lineGraphics.lineTo(b.x, b.y);
			}
			
			var result, t;
			
			if (drawVD) {
				var xu = (a.x + b.x) * 0.5;
				var yu = (a.y + b.y) * 0.5;
				var theta = Math.atan2((b.y - a.y), (b.x - a.x));
				var far = Math.max(RENDER_HEIGHT, RENDER_WIDTH) * 2;
				var da = new PIXI.Point(xu - far*Math.sin(theta), 
										yu + far*Math.cos(theta));
				var db = new PIXI.Point(xu + far*Math.sin(theta), 
										yu - far*Math.cos(theta));
				if (ccw(a, b, da)) {
					var tmp = da;
					da = db;
					db = tmp;
				}
				
				t = this.oprev();
				if (rightOf(t.dest2d(), this)) {
					result = circumCircle(a, b, t.dest2d());
					da = result[0];
				}
				t = this.onext();
				if (leftOf(t.dest2d(), this)) {
					result = circumCircle(a, t.dest2d(), b);
					db = result[0];
				}
				
				lineGraphics.lineStyle(voronoiEdgeWidth, voronoiEdgeColor);
				lineGraphics.moveTo(da.x, da.y);
				lineGraphics.lineTo(db.x, db.y);
			}
			
			if (drawVoronoiCircles) {
				t = this.oprev();
				if (rightOf(t.dest2d(), this)) {
					result = circumCircle(a, b, t.dest2d());
					lineGraphics.lineStyle(voronoiCircleWidth, voronoiCircleColor);
					lineGraphics.drawCircle(result[0].x, result[0].y, result[1]);
				}
			}
			
			this.onext().draw(stamp);
			this.oprev().draw(stamp);
			this.dnext().draw(stamp);
			this.dprev().draw(stamp);
		}
	}
	
	drawSolid(edgeColor) {
		var a = this.org2d();
		var b = this.dest2d();
			
		lineGraphics.lineStyle(triangleEdgeWidth, edgeColor);
		lineGraphics.moveTo(a.x, a.y);
		lineGraphics.lineTo(b.x, b.y);
	}
}


class QuadEdge {
	constructor(num) {
		this.e = [];
		for (var i = 0; i < 4; i++) {
			this.e.push(new Edge());
		}
		for (var i = 0; i < 4; i++) {
			this.e[i].num = i;
			this.e[i].qEdge = this;
		}
		this.e[0].next = this.e[0];
		this.e[1].next = this.e[3];
		this.e[2].next = this.e[2];
		this.e[3].next = this.e[1];
		
		this.ts = 0;
	}
	
	timeStamp(stamp) {
		if (this.ts != stamp) {
			this.ts = stamp;
			return true;
		} else {
			return false;
		}
	}
}


class Subdivision {
	constructor(a, b, c) {
		var da, db, dc;
		da = a.clone();
		db = b.clone();
		dc = c.clone();
		var ea = makeEdge();
		ea.endPoints(da, db);
		var eb = makeEdge();
		splice(ea.sym(), eb);
		eb.endPoints(db, dc);
		var ec = makeEdge();
		splice(eb.sym(), ec);
		ec.endPoints(dc, da);
		splice(ec.sym(), ea);
		this.startingEdge = ea;
	}
	
	locate(x) {
		var e = this.startingEdge;
		
		while (true) {
			if (x.equals(e.org2d()) || x.equals(e.dest2d())) {
				return e;
			} else if (rightOf(x, e)) {
				e = e.sym();
			} else if (rightOf(e.onext().dest2d(), e)) {
				// point is outside
				return [e, false];
			} else if (!rightOf(x, e.onext())) {
				e = e.onext();
			} else if (!rightOf(x, e.dprev())) {
				e = e.dprev();
			} else {
				return [e, true];
			}
		}
	}
	
	insertSite(x) {
		var result = this.locate(x);
		var e = result[0];
		var inside = result[1];
		
		if (x.equals(e.org2d()) || x.equals(e.dest2d())) {
			return;
		} else if (onEdge(x, e)) {
			e = e.oprev();
			deleteEdge(e.onext());
		}
		
		var base = makeEdge();
		base.endPoints(e.org(), x.clone());
		splice(base, e);
		this.startingEdge = base;
		if (inside) {
			do {
				base = connect(e, base.sym());
				e = base.oprev();
			} while (e.lnext() != this.startingEdge);
		} else {
			// TODO: check if new point on edge of convex hull handled properly?
			do {
				base = connect(e, base.sym());
				e = base.oprev();
			} while (rightOf(e.dest2d(), base));
			e = base.onext().sym();
			
			while (leftOf(this.startingEdge.onext().dest2d(), this.startingEdge)) {
				var newEdge = connect(this.startingEdge, this.startingEdge.onext().sym());
				this.startingEdge = newEdge.sym();
			}
		}
		
		do {
			var t = e.oprev();
			if (rightOf(t.dest2d(), e) 
				&& inCircle(e.org2d(), t.dest2d(), e.dest2d(), x)) {
				swap(e);
				e = e.oprev();
			} else if (e.onext() == this.startingEdge) {
				return;
			} else {
				e = e.onext().lprev();
			}
		} while (true);
	}
	
	draw() {
		if (++timestamp == 0) {
			timestamp = 1;
		}
		this.startingEdge.draw(timestamp);
	}
}


function triArea(a, b, c) {
	return (b.x - a.x)*(c.y - a.y) - (b.y - a.y)*(c.x - a.x);
}

function inCircle(a, b, c, d) {
	return (a.x*a.x + a.y*a.y) * triArea(b, c, d) -
	       (b.x*b.x + b.y*b.y) * triArea(a, c, d) +
	       (c.x*c.x + c.y*c.y) * triArea(a, b, d) -
	       (d.x*d.x + d.y*d.y) * triArea(a, b, c) > 0;
}

function circumCircle(a, b, c) {
	var x1 = b.x - a.x;
	var y1 = b.y - a.y;
	var x2 = c.x - a.x;
	var y2 = c.y - a.y;

    var z1 = x1 * x1 + y1 * y1;
    var z2 = x2 * x2 + y2 * y2;
    var d = 2 * (x1 * y2 - x2 * y1);

    var xc = (z1 * y2 - z2 * y1) / d + a.x;
    var yc = (x1 * z2 - x2 * z1) / d + a.y;
    
    var center = new PIXI.Point(xc, yc);
    var dx = xc - a.x;
    var dy = yc - a.y;
    var radius = Math.sqrt(dx*dx + dy*dy);
    
    return [center, radius];
}

function ccw(a, b, c) {
	return (triArea(a, b, c) > 0);
}

function rightOf(x, e) {
	return ccw(x, e.dest2d(), e.org2d());
}

function leftOf(x, e) {
	return ccw(x, e.org2d(), e.dest2d());
}

function onEdge(x, e) {
	var t1, t2, t3;
	t1 = new THREE.Vector2(x.x - e.org2d().x, x.y - e.org2d().y).length();
	t2 = new THREE.Vector2(x.x - e.dest2d().x, x.y - e.dest2d().y).length();
	if (t1 < EPSILON || t2 < EPSILON) {
		return true;
	}
	t3 = new THREE.Vector2(e.org2d().x - e.dest2d().x, 
						e.org2d().y - e.dest2d().y).length();
	if (t1 > t3 || t2 > t3) {
		return false;
	}
	var line = new Line(e.org2d(), e.dest2d());
	return (Math.abs(line.eval(x)) < EPSILON);
}

function makeEdge() {
	var q1 = new QuadEdge();
	return q1.e[0];
}

function splice(a, b) {
	var alpha = a.onext().rot();
	var beta = b.onext().rot();
	
	var t1 = b.onext();
	var t2 = a.onext();
	var t3 = beta.onext();
	var t4 = alpha.onext();
	
	a.next = t1;
	b.next = t2;
	alpha.next = t3;
	beta.next = t4;
}

function deleteEdge(e) {
	splice(e, e.oprev());
	splice(e.sym(), e.sym().oprev());
	delete e.qEdge;
}


function connect(a, b) {
	var e = makeEdge();
	splice(e, a.lnext());
	splice(e.sym(), b);
	e.endPoints(a.dest(), b.org());
	return e;
}

function swap(e) {
	var a = e.oprev();
	var b = e.sym().oprev();
	splice(e, a);
	splice(e.sym(), b);
	splice(e, a.lnext());
	splice(e.sym(), b.lnext());
	e.endPoints(a.dest(), b.dest());
}


/**
 * Initializes WebGL using three.js and sets up the scene
 */
function init() {
	renderer = PIXI.autoDetectRenderer(RENDER_WIDTH, RENDER_HEIGHT, { backgroundColor: 0x000000, antialias: true });
	renderer.backgroundColor = backgroundColor;
	    
	// Add the render window to the document
	document.body.appendChild( renderer.view );
	
	// Create the main stage for your display objects
	stage = new PIXI.Container();
	stage.position.y = renderer.height / renderer.resolution;
	stage.scale.y = -1;
	
	var dummy = new PIXI.Container();
	dummy.interactive = true;
	dummy.hitArea = new PIXI.Rectangle(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
	dummy
		.on('mousedown', onStageClick)
	    .on('touchstart', onStageClick);
	stage.addChild(dummy);

	lineGraphics = new PIXI.Graphics();
	stage.addChild(lineGraphics);

	// Start animating
	animate();
}

function addPoint(x, y) {
	// Initialize the pixi Graphics class
	var graphics = new PIXI.Graphics();
	
    graphics.beginFill(pointColor);
    graphics.drawCircle(0, 0, pointRadius);
    graphics.interactive = true;
    graphics.buttonMode = true;
    graphics.hitArea = new PIXI.Circle(0, 0, pointRadius);
    graphics
    	.on('mousedown', onPointDragStart)
	    .on('touchstart', onPointDragStart)
	    .on('mouseup', onPointDragEnd)
	    .on('mouseupoutside', onPointDragEnd)
	    .on('touchend', onPointDragEnd)
	    .on('touchendoutside', onPointDragEnd)
	    .on('mousemove', onPointDragMove)
	    .on('touchmove', onPointDragMove);
	graphics.position.x = x;
	graphics.position.y = y;
    graphics.endFill(pointColor);
    
    // Add the graphics to the stage
	stage.addChild(graphics);
	
	pointGraphics.push(graphics);
}

function onStageClick(event) {
	var newPosition = event.data.getLocalPosition(this.parent);
	addPoint(newPosition.x, newPosition.y);
}

function onPointDragStart(event) {
    // store a reference to the data
    // the reason for this is because of multitouch
    // we want to track the movement of this particular touch
    this.data = event.data;
    this.alpha = 0.5;
    this.dragging = true;
}

function onPointDragEnd() {
    this.alpha = 1;

    this.dragging = false;

    // set the interaction data to null
    this.data = null;
}

function onPointDragMove() {
    if (this.dragging) {
        var newPosition = this.data.getLocalPosition(this.parent);
        this.position.x = newPosition.x;
        this.position.y = newPosition.y;
    }
}

/**
 * Animate function
 */
function animate() {
	points.length = 0;
	for (var i = 0; i < pointGraphics.length; ++i) {
		var p = new PIXI.Point(pointGraphics[i].position.x, 
								pointGraphics[i].position.y);
		points.push(p);
	}
	
	// Triangulate
	if (points.length < 3) {
		renderer.render(stage);
	} else if (points.length >= 3) {
		mesh = new Subdivision(points[0], points[1], points[2]);
		if (points.length == 3) {
			lineGraphics.clear();
			mesh.draw();
			renderer.render(stage);
		} else {
			for (var i = 3; i < points.length; ++i) {
				mesh.insertSite(points[i]);
			}
			lineGraphics.clear();
			mesh.draw();
			renderer.render(stage);
		}
	}
	
    requestAnimationFrame(animate);
}

return {
	init: init
};

}();

incrementalDelaunay.init();