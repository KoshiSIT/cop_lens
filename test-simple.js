// Simple test file for COP-lens dependency detection

class TestClass {
    constructor() {
        this.service = new TestService();
        this.data = "test";
    }
    
    process() {
        return this.service.execute();
    }
}

class TestService {
    constructor() {
        this.initialized = true;
    }
    
    execute() {
        return "executed";
    }
}

class TestWidget {
    constructor(testClass) {
        this.testClass = testClass;
        this.renderer = new TestRenderer();
    }
    
    render() {
        return this.renderer.draw();
    }
}

class TestRenderer {
    draw() {
        return "rendered";
    }
}

// Usage example
const test = new TestClass();
const widget = new TestWidget(test);
