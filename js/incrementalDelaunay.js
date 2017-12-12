/**
 * Incremental Delaunay Triangulation
 *
 * @author Pratith Kanagaraj <pxk5958@rit.edu>, 2017
 */

/* global THREE */
/* global d3 */


var incrementalDelaunay = function() {

const EPSILON = 1e-6;
const WIDTH = 720;
const HEIGHT = 720;
const SLIDER_MIN = 0;
const SLIDER_MAX = 100;

var pointRadius = 5;

var allPoints = [];
var mesh;
var timestamp = 0;

var svg = d3.select("#canvas").select("svg")
		.attr("width", WIDTH)
    .attr("height", HEIGHT)
		.attr("border", 1);
var borderPath = svg.append("rect")
       			.attr("x", 0)
       			.attr("y", 0)
       			.attr("height", HEIGHT)
       			.attr("width", WIDTH)
       			.style("stroke", 'black')
       			.style("fill", "none")
       			.style("stroke-width", 1);
       			
var drawDT = true;
var drawVD = false;
var drawVoronoiCircles = false;
d3.select("#vorCellsCheckbox").on("change",function() {
	drawVD = d3.select("#vorCellsCheckbox").property("checked");
	redraw(frameData[currFrameIdx]);
});
d3.select("#vorCirclesCheckbox").on("change",function() {
	drawVoronoiCircles = d3.select("#vorCirclesCheckbox").property("checked");
	redraw(frameData[currFrameIdx]);
});

var frameData = [];
frameData.push(emptyData());
var currFrameIdx = 0;

function emptyData() {
	return {
		points: [],
		triEdges: [],
		vorEdges: [],
		vorCircles: [],
		newEdges: [],
		delEdges: [],
		redCircles: [],
		greenCircles: [],
		bluePoints: [],
		redPoints: [],
		greenPoints: [],
		middleSteps: true
	};
}

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
	
	draw(stamp, data) {
		if (this.qEdge.timeStamp(stamp)) {
			var a = this.org2d();
			var b = this.dest2d();
			
			data.triEdges.push({
				x1: a.x,
				y1: a.y,
				x2: b.x,
				y2: b.y
			});
				
			var result, t;
			
			var xu = (a.x + b.x) * 0.5;
			var yu = (a.y + b.y) * 0.5;
			var theta = Math.atan2((b.y - a.y), (b.x - a.x));
			var far = Math.max(HEIGHT, WIDTH) * 2;
			var da = {
				x: xu - far*Math.sin(theta), 
				y: yu + far*Math.cos(theta)
				
			};
			var db = {
				x: xu + far*Math.sin(theta), 
				y: yu - far*Math.cos(theta)
				
			};
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
			
			data.vorEdges.push({
				x1: da.x,
				y1: da.y,
				x2: db.x,
				y2: db.y
			});
			
			t = this.oprev();
			if (rightOf(t.dest2d(), this)) {
				result = circumCircle(a, b, t.dest2d());
				data.vorCircles.push({
					cx: result[0].x, 
					cy: result[0].y, 
					r: result[1]
				});
			}
			
			this.onext().draw(stamp, data);
			this.oprev().draw(stamp, data);
			this.dnext().draw(stamp, data);
			this.dprev().draw(stamp, data);
		}
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
		//var oldData = frameData[frameData.length-1];
		//frameData = [];
		//frameData.push(oldData);
		
		var newData = emptyData();
		newData.points.push(a);
		newData.points.push(b);
		newData.points.push(c);
		frameData.push(newData);
		
		var da, db, dc;
		da = a;
		db = b;
		dc = c;
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
		
		var newEdgesData = emptyData();
		newEdgesData.newEdges.push({
			x1: a.x,
			y1: a.y,
			x2: b.x,
			y2: b.y
		});
		newEdgesData.newEdges.push({
			x1: b.x,
			y1: b.y,
			x2: c.x,
			y2: c.y
		});
		newEdgesData.newEdges.push({
			x1: c.x,
			y1: c.y,
			x2: a.x,
			y2: a.y
		});
		newEdgesData.points = frameData[frameData.length-1].points;
		frameData.push(newEdgesData);
		
		newData = emptyData();
		this.draw(newData);
		newData.points = frameData[frameData.length-1].points;
		newData.middleSteps = false;
		frameData.push(newData);
	}
	
	locate(x) {
		var e = this.startingEdge;
		
		while (true) {
			if ((x.x == e.org2d().x && x.y == e.org2d().y) 
				|| (x.x == e.dest2d().x && x.y == e.dest2d().y)) {
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
		
		if ((x.x == e.org2d().x && x.y == e.org2d().y) 
			|| (x.x == e.dest2d().x && x.y == e.dest2d().y)) {
			return;
		}
		
		var newData = emptyData();
		var prevData = frameData[frameData.length-1];
		for (var i = 0; i < prevData.points.length; ++i) {
			newData.points.push(prevData.points[i]);
		}
		newData.points.push(x);
		newData.triEdges = prevData.triEdges;
		newData.vorEdges = prevData.vorEdges;
		newData.vorCircles = prevData.vorCircles;
		frameData.push(newData);
		
		if (onEdge(x, e)) {
			var deleteEdgeData = emptyData();
			this.draw(deleteEdgeData);
			deleteEdgeData.points = frameData[frameData.length-1].points;
			baseData.delEdges.push({
				x1: e.org().x,
				y1: e.org().y,
				x2: e.dest().x,
				y2: e.dest().y
			});
			frameData.push(deleteEdgeData);
			
			e = e.oprev();
			deleteEdge(e.onext());
		}

		var newEdges = [];
		
		var base = makeEdge();
		base.endPoints(e.org(), x);
		splice(base, e);
		this.startingEdge = base;
		newEdges.push({
			x1: base.org().x,
			y1: base.org().y,
			x2: base.dest().x,
			y2: base.dest().y
		});
		if (inside) {
			do {
				base = connect(e, base.sym());
				e = base.oprev();
				
				newEdges.push({
					x1: base.org().x,
					y1: base.org().y,
					x2: base.dest().x,
					y2: base.dest().y
				});
			} while (e.lnext() != this.startingEdge);
		} else {
			do {
				base = connect(e, base.sym());
				e = base.oprev();
				
				newEdges.push({
					x1: base.org().x,
					y1: base.org().y,
					x2: base.dest().x,
					y2: base.dest().y
				});
			} while (rightOf(e.dest2d(), base));
			e = base.onext().sym();
			
			while (leftOf(this.startingEdge.onext().dest2d(), this.startingEdge)) {
				var newEdge = connect(this.startingEdge, this.startingEdge.onext().sym());
				this.startingEdge = newEdge.sym();
				
				newEdges.push({
					x1: newEdge.org().x,
					y1: newEdge.org().y,
					x2: newEdge.dest().x,
					y2: newEdge.dest().y
				});
			}
		}
		
		if (newEdges.length > 0) {
			var newEdgesData = emptyData();
			prevData = frameData[frameData.length-1];
			newEdgesData.triEdges = prevData.triEdges;
			newEdgesData.vorEdges = prevData.vorEdges;
			newEdgesData.vorCircles = prevData.vorCircles;
			newEdgesData.newEdges = newEdges;
			newEdgesData.points = prevData.points;
			frameData.push(newEdgesData);
		}
		
		do {
			var baseData = emptyData();
			this.draw(baseData);
			baseData.points = frameData[frameData.length-1].points;
			
			var t = e.oprev();
			if (rightOf(t.dest2d(), e)  
				&& this.inCircleSteps(e.org2d(), t.dest2d(), e.dest2d(), x, baseData)) {
				swap(e);
				
				baseData.newEdges.push({
					x1: e.org().x,
					y1: e.org().y,
					x2: e.dest().x,
					y2: e.dest().y
				});
				frameData.push(baseData);
				
				e = e.oprev();
			} else if (e.onext() == this.startingEdge) {
				baseData = emptyData();
				this.draw(baseData);
				baseData.points = frameData[frameData.length-1].points;
				baseData.middleSteps = false;
				frameData.push(baseData);
				return;
			} else {
				e = e.onext().lprev();
			}
		} while (true);
	}
	
	inCircleSteps(a, b, c, d, baseData) {
		baseData.bluePoints.push(a);
		baseData.bluePoints.push(b);
		baseData.bluePoints.push(c);
		var circle = circumCircle(a, b, c);
		if (inCircle(a, b, c, d)) {
			baseData.redCircles.push({
				cx: circle[0].x, 
				cy: circle[0].y, 
				r: circle[1]
			});
			baseData.redPoints.push(d);
			baseData.delEdges.push({
				x1: a.x,
				y1: a.y,
				x2: c.x,
				y2: c.y
			});
			
			return true;
		} else {
			baseData.greenCircles.push({
				cx: circle[0].x, 
				cy: circle[0].y, 
				r: circle[1]
			});
			baseData.greenPoints.push(d);
			frameData.push(baseData);
			
			return false;
		}
	}
	
	draw(data) {
		if (++timestamp == 0) {
			timestamp = 1;
		}
		this.startingEdge.draw(timestamp, data);
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
    
    var center = {
		x: xc,
    	y: yc
	};
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


svg
.on("click", function() {
	if (currFrameIdx == frameData.length-1) {
		var coords = d3.mouse(this);
		var point = {
			x: coords[0],
	    	y: coords[1]
		};
		allPoints.push(point);
		
		// Triangulate
		if (allPoints.length >= 3) {
			if (allPoints.length == 3) {
				mesh = new Subdivision(allPoints[0], allPoints[1], allPoints[2]);
			} else {
				mesh.insertSite(point);
			}
		} else {
			var newData = emptyData();
			if (frameData.length > 0) {
				var prevData = frameData[frameData.length-1];
				for (var i = 0; i < prevData.points.length; ++i) {
					newData.points.push(prevData.points[i]);
				}
			}
			newData.points.push(point);
			frameData.push(newData);
		}
		
		slider.setValue(SLIDER_MAX);
	}
});

function redraw(data) {
		var middleSteps = data.middleSteps;
    var vorCircles = svg.selectAll("circle.vorCircle")
      .data((!middleSteps && drawVoronoiCircles) ? data.vorCircles : []);
    vorCircles.exit().remove();
    vorCircles.enter()
      .append("circle")
      .attr("class", "vorCircle")
      .merge(vorCircles)
      .attr("cx", function(d) { return d.cx; })
      .attr("cy", function(d) { return d.cy; })
      .attr("r", function(d) { return d.r; });
    
    var vorEdges = svg.selectAll("line.vorEdge")
      .data((!middleSteps && drawVD) ? data.vorEdges : []);
    vorEdges.exit().remove();
    vorEdges.enter()
      .append("line")
      .attr("class", "vorEdge")
      .merge(vorEdges)
      .attr("x1", function(d) { return d.x1; })
      .attr("y1", function(d) { return d.y1; })
      .attr("x2", function(d) { return d.x2; })
      .attr("y2", function(d) { return d.y2; });
      
    var redCircles = svg.selectAll("circle.redCircle")
      .data(data.redCircles);
    redCircles.exit().remove();
    redCircles.enter()
      .append("circle")
      .attr("class", "redCircle")
      .merge(redCircles)
      .attr("cx", function(d) { return d.cx; })
      .attr("cy", function(d) { return d.cy; })
      .attr("r", function(d) { return d.r; });
      
    var greenCircles = svg.selectAll("circle.greenCircle")
      .data(data.greenCircles);
    greenCircles.exit().remove();
    greenCircles.enter()
      .append("circle")
      .attr("class", "greenCircle")
      .merge(greenCircles)
      .attr("cx", function(d) { return d.cx; })
      .attr("cy", function(d) { return d.cy; })
      .attr("r", function(d) { return d.r; });
      
    var bluePoints = svg.selectAll("circle.bluePoint")
      .data(data.bluePoints);
    bluePoints.exit().remove();
    bluePoints.enter()
      .append("circle")
      .attr("class", "bluePoint")
      .merge(bluePoints)
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", pointRadius);
      
    var greenPoints = svg.selectAll("circle.greenPoint")
      .data(data.greenPoints);
    greenPoints.exit().remove();
    greenPoints.enter()
      .append("circle")
      .attr("class", "greenPoint")
      .merge(greenPoints)
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", pointRadius);
      
    var redPoints = svg.selectAll("circle.redPoint")
      .data(data.redPoints);
    redPoints.exit().remove();
    redPoints.enter()
      .append("circle")
      .attr("class", "redPoint")
      .merge(redPoints)
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", pointRadius);
      
    var newEdges = svg.selectAll("line.newEdge")
      .data(data.newEdges);
    newEdges.exit().remove();
    newEdges.enter()
      .append("line")
      .attr("class", "newEdge")
      .merge(newEdges)
      .attr("x1", function(d) { return d.x1; })
      .attr("y1", function(d) { return d.y1; })
      .attr("x2", function(d) { return d.x2; })
      .attr("y2", function(d) { return d.y2; });
    
    var triEdges = svg.selectAll("line.triEdge")
      .data(drawDT ? data.triEdges : []);
    triEdges.exit().remove();
    triEdges.enter()
      .append("line")
      .attr("class", "triEdge")
      .merge(triEdges)
      .attr("x1", function(d) { return d.x1; })
      .attr("y1", function(d) { return d.y1; })
      .attr("x2", function(d) { return d.x2; })
      .attr("y2", function(d) { return d.y2; });
    
    var delEdges = svg.selectAll("line.delEdge")
      .data(data.delEdges);
    delEdges.exit().remove();
    delEdges.enter()
      .append("line")
      .attr("class", "delEdge")
      .merge(delEdges)
      .attr("x1", function(d) { return d.x1; })
      .attr("y1", function(d) { return d.y1; })
      .attr("x2", function(d) { return d.x2; })
      .attr("y2", function(d) { return d.y2; });
      
    var points = svg.selectAll("circle.point")
      .data(data.points);
    points.exit().remove();
    points.enter()
      .append("circle")
      .attr("class", "point")
      .merge(points)
      .attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; })
      .attr("r", pointRadius);
}

var slider = d3.slider()
	.min(SLIDER_MIN)
	.max(SLIDER_MAX)
	.showRange(true)
	.value(100)
	.tickFormat(function(d) {
		return "";
	})
	.callback(function(slider) {
		var alpha = slider.getValue() / (SLIDER_MAX - SLIDER_MIN);
		currFrameIdx = Math.round(alpha * (frameData.length-1));
		redraw(frameData[currFrameIdx]);
	});
d3.select('#slider').call(slider);

}();