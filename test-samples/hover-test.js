const { Layer, Signal, SignalComp, EMA } = require('./EMAjs');

// Signal definition
const gyroLevel = new Signal(0);
const serverConnected = new Signal(false);

// Layer definition (object literal style)
const landscape = {
    condition: new SignalComp("gyroLevel > 45"),
    enter: function() {
        console.log("Entering landscape mode");
    },
    exit: function() {
        console.log("Exiting landscape mode");
    }
};

// Layer definition (constructor style)
const onlineEditor = new Layer("onlineEditor");
onlineEditor.condition = new SignalComp("serverConnected === true");

// Create target objects
const screen = {
    gyroscope: gyroLevel,
    orientation: "portrait"
};

const playerView = {
    draw: function() {
        console.log("Drawing player view");
    }
};

const videoGame = {
    draw: function() {
        console.log("Drawing video game");
    }
};

// EMA.exhibit - expose properties
EMA.exhibit(screen, {
    gyro: screen.gyroscope,
    orient: "landscape"
});

// EMA.addPartialMethod - add context-specific behavior
EMA.addPartialMethod(landscape, playerView, "draw", function() {
    console.log("Drawing player view in LANDSCAPE mode");
    Layer.proceed();
});

EMA.addPartialMethod(landscape, videoGame, "draw", function() {
    console.log("Drawing video game in LANDSCAPE mode");
    Layer.proceed();
});

// EMA.deploy - activate layer
EMA.deploy(landscape);

// Test
playerView.draw();
