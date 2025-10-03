# EMA.js Framework Analysis

## Overview

EMA.js (Event-based Middleware Architecture) is a Context-Oriented Programming framework for JavaScript that implements dynamic behavior switching based on signal changes. The framework enables runtime adaptation through layers that can be activated/deactivated based on contextual conditions.

## Core Architecture Components

### 1. Signal System

#### Signal Class (`src/Signal.js`)
**Purpose**: Base reactive primitive that emits events when its value changes

**Key Features**:
- Observer pattern implementation with `_subscribers` array
- Change detection: only emits when `_lastVal !== val`
- Timestamp tracking with `performance-now`
- Automatic emission on value change

```javascript
// Usage Pattern
let battery = new Signal(100);
battery.on((value, id) => console.log(`Signal ${id} changed to ${value}`));
battery.value = 80; // Triggers emission
```

#### SignalComp Class (`src/SignalComp.js`)
**Purpose**: Composite signal that evaluates expressions using multiple signals

**Key Features**:
- Expression-based evaluation using ExpressionInterpreter
- Dynamic signal dependency management
- Context preparation from multiple signal values
- Re-evaluation triggered by dependent signal changes

```javascript
// Usage Pattern
let condition = new SignalComp("level < 30", [levelSignal]);
condition.on((active) => console.log(`Condition active: ${active}`));
```

### 2. Layer System

#### Layer Class (`src/Layer.js`)
**Purpose**: Represents a context that can activate/deactivate based on conditions

**Core Mechanism**:
- **Condition Monitoring**: Uses SignalComp to watch for activation conditions
- **Method Installation**: Replaces target methods when active
- **Method Restoration**: Restores original methods when inactive
- **Lifecycle Hooks**: `enter()` and `exit()` callbacks

**Key Methods:**
- `enableCondition()`: Sets up condition monitoring
- `_installPartialMethod()`: Replaces methods with partial implementations
- `_uninstallPartialMethods()`: Restores original methods
- `addSignal()`: Adds signals to condition evaluation

### 3. EMA Central Controller

#### EMA Class (`src/EMA.js`)
**Purpose**: Singleton orchestrator managing all layers and signal interfaces

**Core Responsibilities**:
- Layer deployment and lifecycle management
- Signal interface registration and propagation
- Coordination between signals and layers

## EMA.js Core Operations Analysis

### 1. EMA.exhibit(object, signalInterface)

**Purpose**: Exposes object signals to the COP system for layer condition evaluation

**Internal Mechanics**:
```javascript
exhibit(object, signalInterface) {
    // Store object-signal mapping
    this._signalInterfacePool.push([object, signalInterface]);
    
    // Assign IDs to signals for expression evaluation
    this._addIdSignal(signalInterface);
    
    // Propagate signals to all deployed layers
    this._exhibitAnInterface(signalInterface);
}
```

**What Really Happens**:
1. **Signal Registration**: Signals become globally available with named identifiers
2. **Layer Connection**: All deployed layers receive these signals for condition evaluation
3. **Context Creation**: Signals can be referenced in layer conditions by name

**Example Flow**:
```javascript
EMA.exhibit(battery, {level: battery.charge});
// → battery.charge signal becomes available as "level" in layer conditions
// → All deployed layers with conditions like "level < 30" can now evaluate
```

### 2. EMA.addPartialMethod(layer, targetObj, methodName, implementation)

**Purpose**: Registers a partial method that will replace the original when layer is active

**Internal Mechanics**:
```javascript
addPartialMethod(originalLayer, objs, methodName, partialMethodImpl) {
    objs.forEach(obj => {
        // Store original method before first modification
        OriginalMethodsPool.add(obj, methodName);
        
        // Register partial method for this layer
        PartialMethodsPool.add(obj, methodName, partialMethodImpl, originalLayer);
    });
}
```

**What Really Happens**:
1. **Original Preservation**: First access to a method saves its original implementation
2. **Partial Registration**: Partial method is stored with layer association
3. **Lazy Installation**: Methods are only replaced when layer becomes active

### 3. EMA.deploy(layerDefinition)

**Purpose**: Activates a layer in the system and connects it to existing signals

**Internal Mechanics**:
```javascript
deploy(originalLayer) {
    // Create Layer instance from definition
    let layer = new Layer(originalLayer);
    
    // Add to active layer pool
    this._deployedLayers.push(layer);
    
    // Connect to all existing signals
    this._receiveSignalsForSignalInterfaces(layer);
}
```

**Critical Process Flow**:
1. **Layer Instantiation**: Creates Layer object with condition monitoring
2. **Signal Propagation**: Sends all existing signals to new layer
3. **Condition Evaluation**: Layer immediately evaluates its condition
4. **Auto-activation**: If condition is true, layer installs partial methods

### 4. Layer.proceed()

**Purpose**: Calls the original method from within a partial method

**Internal Mechanics**:
```javascript
// Inside _installPartialMethod()
obj[methodName] = function() {
    // Set up proceed function for this invocation
    Layer.proceed = function() {
        return Layer._executeOriginalMethod(obj, methodName, arguments);
    };
    
    // Execute partial method with proceed available
    let result = partialMethodImpl.apply(obj, args);
    
    // Clean up proceed to avoid interference
    Layer.proceed = undefined;
    return result;
};
```

## Signal Detection and Dynamic Switching Mechanism

### Signal Change Detection
1. **Value Monitoring**: Signal.value setter compares with `_lastVal`
2. **Emission Trigger**: Only emits when value actually changes
3. **Subscriber Notification**: All registered subscribers receive new value
4. **Cascade Evaluation**: SignalComp expressions re-evaluate automatically

### Layer Activation Process
```
Signal Value Change 
    ↓
SignalComp Re-evaluation 
    ↓  
Condition Result Change
    ↓
Layer Activation/Deactivation
    ↓
Method Installation/Restoration
```

### Dynamic Method Switching
1. **Condition True**: 
   - `layer._enter()` called
   - `layer._installPartialMethod()` replaces target methods
   - Partial methods become active

2. **Condition False**:
   - `layer._exit()` called  
   - `layer._uninstallPartialMethods()` restores original methods
   - Layer becomes dormant

## Layer Definition vs Instance Pattern

### Why Examples Don't Use `new Layer()` Directly

EMA.js uses a **two-phase pattern**:

```javascript
// ❌ Don't create Layer instances directly
let layer = new Layer({ condition: "level < 30" });

// ✅ Create layer definition objects
let lowBattery = {
    condition: new SignalComp("level < 30"), // or string
    enter: function() { /* ... */ },
    exit: function() { /* ... */ }
};

// ✅ EMA.deploy() creates Layer instance internally
EMA.deploy(lowBattery);  // ← new Layer(lowBattery) executed here
```

### Information Injection Timeline

#### Phase 1: Definition Stage (Static)
```javascript
// Layer definition
let layerDef = { condition: "networkStatus === 'online'" };

// Partial method association (stored in pool, not yet active)
EMA.addPartialMethod(layerDef, editor, "save", function(){...});
// → PartialMethodsPool: [editor, "save", function, layerDef]

// Signal registration (stored in global pool)
EMA.exhibit(networkManager, {networkStatus: networkManager.status});
// → _signalInterfacePool: [networkManager, {networkStatus: signal}]
```

#### Phase 2: Integration Stage - EMA.deploy() ⭐
```javascript
EMA.deploy(layerDef);
```

**Critical Information Injection Process:**

1. **Layer Instantiation**:
   ```javascript
   let layer = new Layer(originalLayer);  // layerDef → Layer instance
   ```

2. **Signal Injection**:
   ```javascript
   this._receiveSignalsForSignalInterfaces(layer);
   // → All existing signals sent to this layer
   // → layer.addSignal(networkStatus signal) executed
   // → Layer condition evaluation becomes possible
   ```

3. **Auto-activation**:
   ```javascript
   // Inside Layer constructor - automatically executed
   this.enableCondition();  // Start condition monitoring
   // → If networkStatus === 'online' is true, activate immediately
   ```

#### Phase 3: Runtime Stage (Dynamic)
```javascript
signal.value = newValue;
// → SignalComp.evaluate()     : Re-evaluate conditions
// → layer activation change   : Toggle activation state
// → _installPartialMethod()   : Install/remove methods
```

### Late Binding Design

**Before Deploy**: Definition-level relationships only
```javascript
layerDef → editor  (addPartialMethod association)
layerDef → signals (condition reference)
```

**After Deploy**: Runtime relationships created
```javascript
Layer Instance → editor       (actual method replacement)
Layer Instance → signals      (actual condition monitoring)
Layer Instance → Runtime Info (activation state, metrics)
```

**Key Insight**: `EMA.deploy()` is the **transformation point** where static associations become dynamic dependencies.

## Key Design Patterns

### 1. Observer Pattern
- Signals notify subscribers of changes
- Layers observe signal changes for activation

### 2. Strategy Pattern 
- Partial methods provide alternative implementations
- Dynamic switching based on context

### 3. Proxy Pattern
- Layers intercept method calls
- Can call original via Layer.proceed()

### 4. Singleton Pattern
- EMA, PartialMethodsPool, OriginalMethodsPool are singletons
- Global coordination of the COP system

### 5. Late Binding Pattern
- Definitions created early
- Actual bindings established at deploy time
- Runtime behavior determined by signal values

## Runtime Behavior Summary

### Initialization Phase
1. Objects and signals created
2. Layer definitions prepared
3. `EMA.exhibit()` registers signals globally
4. `EMA.addPartialMethod()` registers partial methods
5. `EMA.deploy()` activates layers and connects signals

### Runtime Phase
1. Signal values change through program execution
2. SignalComp expressions automatically re-evaluate
3. Layer conditions trigger activation/deactivation
4. Method calls dynamically route to partial or original implementations
5. `Layer.proceed()` provides access to original behavior

### Key Insight: Control Mechanisms
- **Automatic**: Layer activation/deactivation based on signal changes
- **Manual**: Signal value changes triggered by application logic
- **Hybrid**: `enter()`/`exit()` hooks allow custom activation behavior

## Dependency Graph Requirements

### Node Types for COP Visualization
1. **Class Definitions** (Green): RemoteEditor, Editor, etc.
2. **Object Instances** (Orange): editor, server, workRemote instances  
3. **Layer Definitions** (Orange): Layer definition objects
4. **Layer Instances** (Runtime): Deployed layer instances
5. **Signals** (Runtime): Signal/SignalComp instances

### Edge Types for COP Relationships

#### Static Dependencies (Black arrows)
```javascript
{
    type: "composition",
    from: "RemoteEditor", 
    to: "editor",
    relationship: "has-a"
}
```

#### EMA Operations (Gray arrows)
```javascript
{
    type: "exhibit",
    from: "networkManager",
    to: "onlineLayerDef", 
    signal: "networkStatus",
    operation: "EMA.exhibit"
},
{
    type: "addPartialMethod",
    from: "onlineLayerDef",
    to: "editor",
    method: "save",
    operation: "EMA.addPartialMethod"  
}
```

#### Runtime Active Relationships (Blue arrows)
```javascript
{
    type: "active_refinement",
    from: "onlineLayer",
    to: "editor.save",
    status: "active",
    condition: "networkStatus === 'online'"
}
```

## Conclusion

EMA.js enables **context-aware, self-adapting applications** where behavior changes automatically as environmental conditions (signals) change, without requiring explicit conditional logic throughout the application code. The framework's power lies in its **automatic signal propagation** and **late binding architecture**, allowing dynamic method replacement based on contextual conditions.

The **deploy-time information injection** is crucial for understanding how static layer definitions become dynamic runtime behavior, making it the key transformation point for dependency graph visualization.
