var cubeStrip = [
    1, 1, 0,
    0, 1, 0,
    1, 1, 1,
    0, 1, 1,
    0, 0, 1,
    0, 1, 0,
    0, 0, 0,
    1, 1, 0,
    1, 0, 0,
    1, 1, 1,
    1, 0, 1,
    0, 0, 1,
    1, 0, 0,
    0, 0, 0
];

var takeScreenShot = false;
var canvas = null;

var gl = null;
var shader = null;
var volumeTexture = null;
var colormapTex = null;
var fileRegex = /.*\/(\w+)_(\d+)x(\d+)x(\d+)_(\w+)\.*/;
var proj = null;
var camera = null;
var projView = null;
var tabFocused = true;
var newVolumeUpload = true;
var targetFrameTime = 32;
var samplingRate = 1.0;
var WIDTH = 640;
var HEIGHT = 480;

//var x_size = 256;
//var y_size = 256;
//var z_size = 118;

var x_size;// = 60;
var y_size;// = 84;
var z_size;// = 96;

//var x_size = 40;
//var y_size = 56;
//var z_size = 64;



const defaultEye = vec3.set(vec3.create(), 0.5, 0.5, 1.5);
const center = vec3.set(vec3.create(), 0.5, 0.5, 0.5);
const up = vec3.set(vec3.create(), 0.0, 1.0, 0.0);

var colormaps = {
    "Cool Warm": "colormaps/cool-warm-paraview.png",
    "Matplotlib Plasma": "colormaps/matplotlib-plasma.png",
    "Matplotlib Virdis": "colormaps/matplotlib-virdis.png",
    "Rainbow": "colormaps/rainbow.png",
    "Samsel Linear Green": "colormaps/samsel-linear-green.png",
    "Samsel Linear YGB 1211G": "colormaps/samsel-linear-ygb-1211g.png",
};

function readFile() {
    var reader = new FileReader();
    file = document.getElementById("uploadText").files[0];
    console.log("name", typeof(file.name));
    var file_split = file.name.split("_");
    console.log(file_split);
    console.log(typeof(file_split))
    z_size = parseInt(file_split[1]);
    y_size = parseInt(file_split[2]);
    rest = file_split[3];
    x_size = parseInt(rest.substring(0,rest.length-4));
    console.log("deminsions: ", x_size, y_size, z_size);

    var loadingProgressText = document.getElementById("loadingText");
    var loadingProgressBar = document.getElementById("loadingProgressBar");
    loadingProgressText.innerHTML = "Loading Volume";
    loadingProgressBar.setAttribute("style", "width: 0%");
   
    reader.onprogress = function(evt) {
        console.log("loaded",evt.loaded);
        console.log("total",evt.total);
        var percent = evt.loaded / evt.total;
        //var vol_size = volDims[0] * volDims[1] * volDims[2];
        //var percent = evt.loaded / vol_size * 100;
        console.log("percent", percent.toFixed(2));
        loadingProgressBar.setAttribute("style", "width: " + percent.toFixed(2) + "%");
    };
    reader.onerror = function(evt) {
        loadingProgressText.innerHTML = "Error Loading Volume";
        loadingProgressBar.setAttribute("style", "width: 0%");
    };
    reader.onload = function (evt) {
        loadingProgressText.innerHTML = "Loaded Volume";
        loadingProgressBar.setAttribute("style", "width: 100%");

        var text = new Float32Array(reader.result);
        console.log(text);
        console.log(text.length);


        selectLocalVolume(text)
        //selectLocalVolume(makeDataFloat(10, 10, 10))
    };
    //reader.readAsText(file);
    //reader.readAsDataURL(file);
    reader.readAsArrayBuffer(file);
    //reader.readAsBinaryString(file);
};

var makeDataFloat = function(x, y, z) {
    var data = new Float32Array(x*y*z)
    for (var i = 0; i < x; i++) {
        for (var j = 0; j < y; j++) {
            for (var k = 0; k < z; k++) {
                if (i < x/2) {
                    data[i*y*z + j*z + k] = 0.1;
                } else {
                    data[i*y*z + j*z + k] = 0.5;
                }
            }
        }
    }
    return data;
}

var makeDataUint = function(x, y, z) {
    var data = new Uint8Array(x*y*z)
    for (var i = 0; i < x; i++) {
        for (var j = 0; j < y; j++) {
            for (var k = 0; k < z; k++) {
                if (i < x/2) {
                    data[i*y*z + j*z + k] = 1;
                } else {
                    data[i*y*z + j*z + k] = 100;
                }
            }
        }
    }
    return data;
}


var selectLocalVolume = function(text) {

    var volDims = [x_size, y_size, z_size];
    var max = text[0];
    var min = text[0];
    console.log(volDims[0], volDims[1], volDims[2])

    for (var i = 0; i < text.length; i++) {
        if (max < text[i]) {
            max = text[i];
        }
        if (min > text[i]) {
            min = text[i];
        }
    }
    for (var i = 0; i < text.length; i++) {
        text[i] = (text[i] - min)/(max-min);
    }
    console.log("max: ", max, "; min: ", min);
    /* transfer range from 0~1 to 0~255 */
    var text_new = new Uint8Array(x_size * y_size * z_size);
    console.log(text_new.length)
    console.log(text.length)
    for (var i = 0; i < text.length; i++) {
        text_new[i] = Math.floor(179*text[i]);
        //text_new[i] = Math.ceil(179*text[i]);
        //text_new[i] = 250;
    }
    console.log(text_new[0])
    console.log(text[0])
    console.log("coler scale result: ", text_new)
    max = text_new[0];
    min = text_new[0];
    for (var i = 0; i < text.length; i++) {
        if (max < text_new[i]) {
            max = text_new[i];
        }
        if (min > text_new[i]) {
            min = text_new[i];
        }
    }
    console.log("max: ", max, "; min: ", min);

    //text_new = makeDataUint(x_size, y_size, z_size);

    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, tex);
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.R8, volDims[0], volDims[1], volDims[2]);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    console.log(volDims)
    console.log(text_new.length)
    gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0,
        volDims[0], volDims[1], volDims[2],
        gl.RED, gl.UNSIGNED_BYTE, text_new);
        //gl.ALPHA, gl.UNSIGNED_BYTE, text_new);

        
    var longestAxis = Math.max(volDims[0], Math.max(volDims[1], volDims[2]));
    var volScale = [volDims[0] / longestAxis, volDims[1] / longestAxis, volDims[2] / longestAxis];

    gl.uniform3iv(shader.uniforms["volume_dims"], volDims);
    gl.uniform3fv(shader.uniforms["volume_scale"], volScale);


    newVolumeUpload = true;
    if (!volumeTexture) {
        volumeTexture = tex;
        setInterval(function() {
        // Save them some battery if they're not viewing the tab
        if (document.hidden) {
            return;
        }
        var startTime = new Date();
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Reset the sampling rate and camera for new volumes
        if (newVolumeUpload) {
            camera = new ArcballCamera(defaultEye, center, up, 2, [WIDTH, HEIGHT]);
            samplingRate = 1.0;
            gl.uniform1f(shader.uniforms["dt_scale"], samplingRate);
        }
        projView = mat4.mul(projView, proj, camera.camera);
        gl.uniformMatrix4fv(shader.uniforms["proj_view"], false, projView);

        var eye = [camera.invCamera[12], camera.invCamera[13], camera.invCamera[14]];
        gl.uniform3fv(shader.uniforms["eye_pos"], eye);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, cubeStrip.length / 3);
        // Wait for rendering to actually finish
        gl.finish();
        var endTime = new Date();
        var renderTime = endTime - startTime;
        var targetSamplingRate = renderTime / targetFrameTime;

        if (takeScreenShot) {
            takeScreenShot = false;
            canvas.toBlob(function(b) { saveAs(b, "screen.png"); }, "image/png");
        }

        // If we're dropping frames, decrease the sampling rate
        if (!newVolumeUpload && targetSamplingRate > samplingRate) {
            samplingRate = 0.8 * samplingRate + 0.2 * targetSamplingRate;
            gl.uniform1f(shader.uniforms["dt_scale"], samplingRate);
        }

        newVolumeUpload = false;
        startTime = endTime;
    }, targetFrameTime);
    } else {
        gl.deleteTexture(volumeTexture);
        volumeTexture = tex;
    }

}

var selectColormap = function() {
    var selection = document.getElementById("colormapList").value;
    var colormapImage = new Image();
    colormapImage.onload = function() {
        gl.activeTexture(gl.TEXTURE1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
            gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);
    };
    colormapImage.crossOrigin = "";
    colormapImage.src = colormaps[selection];
}

window.onload = function(){
    fillcolormapSelector();

    canvas = document.getElementById("glcanvas");
    gl = canvas.getContext("webgl2");
    if (!gl) {
        alert("Unable to initialize WebGL2. Your browser may not support it");
        return;
    }
    WIDTH = canvas.getAttribute("width");
    HEIGHT = canvas.getAttribute("height");

    proj = mat4.perspective(mat4.create(), 60 * Math.PI / 180.0,
        WIDTH / HEIGHT, 0.1, 100);

    camera = new ArcballCamera(defaultEye, center, up, 2, [WIDTH, HEIGHT]);
    projView = mat4.create();

    // Register mouse and touch listeners
    var controller = new Controller();
    controller.mousemove = function(prev, cur, evt) {
        if (evt.buttons == 1) {
            camera.rotate(prev, cur);

        } else if (evt.buttons == 2) {
            camera.pan([cur[0] - prev[0], prev[1] - cur[1]]);
        }
    };
    controller.wheel = function(amt) { camera.zoom(amt); };
    controller.pinch = controller.wheel;
    controller.twoFingerDrag = function(drag) { camera.pan(drag); };

    document.addEventListener("keydown", function(evt) {
        if (evt.key == "p") {
            takeScreenShot = true;
        }
    });

    controller.registerForCanvas(canvas);

    // Setup VAO and VBO to render the cube to run the raymarching shader
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeStrip), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    shader = new Shader(vertShader, fragShader);
    shader.use();

    gl.uniform1i(shader.uniforms["volume"], 0);
    gl.uniform1i(shader.uniforms["colormap"], 1);
    //gl.uniform1f(shader.uniforms["colormap"], 0.5);
    gl.uniform1f(shader.uniforms["dt_scale"], 1.0);

    // Setup required OpenGL state for drawing the back faces and
    // composting with the background color
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Load the default colormap and upload it, after which we
    // load the default volume.
    var colormapImage = new Image();
    
    var colormapImage_2 = new Uint8Array(180*4);
    for (var i = 0; i < 180; i++) {
        colormapImage_2[i*4] = i;
        colormapImage_2[i*4 + 1] = i; 
        colormapImage_2[i*4 + 2] = i; 
        colormapImage_2[i*4 + 3] = 255; 
    }
    

    colormapImage.onload = function() {
        //colormapImage.style.opacity = "0.01";
        var colormap = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, colormap);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, 180, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
            gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);
        console.log(colormapImage)
    };
    colormapImage.src = "colormaps/cool-warm-paraview.png";

    /* Setup default lower and upper bound on the intensity */
    gl.uniform1f(shader.uniforms["lower_bound"], lower_bound);
    gl.uniform1f(shader.uniforms["upper_bound"], upper_bound);

    var slider_lower_bound = document.getElementById("lower_bound");
    var output_lower_bound = document.getElementById("demo_lower_bound");
    output_lower_bound.innerHTML = slider_lower_bound.value/100; // Display the default slider value

    // Update the current slider value (each time you drag the slider handle)
    slider_lower_bound.oninput = function() {
        var lower_bound = this.value/100;
        output_lower_bound.innerHTML = lower_bound;
        gl.uniform1f(shader.uniforms["lower_bound"], lower_bound);
    }
    
    var slider_upper_bound = document.getElementById("upper_bound");
    var output_upper_bound = document.getElementById("demo_upper_bound");
    output_upper_bound.innerHTML = slider_upper_bound.value/100; // Display the default slider value

    // Update the current slider value (each time you drag the slider handle)
    slider_upper_bound.oninput = function() {
        var upper_bound = this.value/100;
        output_upper_bound.innerHTML = upper_bound;
        gl.uniform1f(shader.uniforms["upper_bound"], upper_bound);
    }

}

var fillcolormapSelector = function() {
    var selector = document.getElementById("colormapList");
    for (p in colormaps) {
        var opt = document.createElement("option");
        opt.value = p;
        opt.innerHTML = p;
        selector.appendChild(opt);
    }
}

