/**
 * Hierarchy Calculator for Dependency Graphs
 * Calculates hierarchy levels using topological sort with BFS (Breadth-First Search)
 */

/**
 * Calculate hierarchy levels for all nodes in a dependency graph
 * Uses BFS to determine the depth of each node from root nodes
 *
 * @param {Map} classes - Map of className -> ClassInfo
 * @param {Map} instances - Map of instanceKey -> InstanceInfo
 * @param {Array} dependencies - Array of dependency objects
 * @returns {Map} Map of nodeId -> level (0 = root, 1 = child, 2 = grandchild, etc.)
 */
function calculateHierarchyLevels(classes, instances, methods, edges) {
    console.log("📊 Starting hierarchy level calculation...");

    // Step 1: Initialize data structures
    const { levels, adjacencyList, inDegree } = initializeDataStructures(
        classes,
        instances,
        methods,
    );

    // Step 2: Build graph from edges
    buildGraph(edges, instances, adjacencyList, inDegree);

    // Step 3: Find root nodes
    const rootNodes = findRootNodes(inDegree);

    if (rootNodes.length === 0) {
        console.warn(" No  root nodes found! Possible circular dependency.");
        return levels;
    }

    // Step 4: Run BFS to calculate levels
    runBFS(rootNodes, adjacencyList, inDegree, levels);

    // Step 5: Log results
    logResults(levels);

    return levels;
}

/**
 * Initialize data structures for BFS
 * @param {Map} classes - Map of class nodes
 * @param {Map} instances - Map of instance nodes
 * @returns {Object} Object containing levels, adjacencyList, and inDegree Maps
 */
function initializeDataStructures(classes, instances, methods) {
    const levels = new Map();
    const adjacencyList = new Map();
    const inDegree = new Map();

    // Initialize all class nodes
    for (const [className] of classes) {
        levels.set(className, 0);
        adjacencyList.set(className, []);
        inDegree.set(className, 0);
    }

    // Initialize all instance nodes
    for (const [instanceKey] of instances) {
        levels.set(instanceKey, 0);
        adjacencyList.set(instanceKey, []);
        inDegree.set(instanceKey, 0);
    }

    // Initialize all method nodes
    for (const [methodKey] of methods) {
        levels.set(methodKey, 0);
        adjacencyList.set(methodKey, []);
        inDegree.set(methodKey, 0);
    }

    console.log(
        `  Initialized ${levels.size} nodes (${classes.size} classes, ${instances.size} instances, ${methods.size} methods)`,
    );

    return { levels, adjacencyList, inDegree };
}

/**
 * Build graph structure from dependencies
 * @param {Array} dependencies - Array of dependency objects
 * @param {Map} instances - Map of instance nodes
 * @param {Map} adjacencyList - Adjacency list to populate
 * @param {Map} inDegree - In-degree map to populate
 */
function buildGraph(edges, instances, adjacencyList, inDegree) {
    for (const edge of edges) {
        const dep = edge.data;
        const sourceId = dep.source;
        let targetId = dep.target;

        // Process all edge types
        if (dep.type === "composition") {
            // Already has correct target
        } else if (dep.type === "aggregation") {
            // Already has correct target
        } else if (dep.type === "hasMethod") {
            // Already has correct target
        } else if (dep.type === "instanceOf") {
            // Skip instanceOf for now, will process separately
            continue;
        } else {
            continue;
        }

        // Add edget to adjacency list
        if (adjacencyList.has(sourceId)) {
            adjacencyList.get(sourceId).push({
                target: targetId,
                type: dep.type,
            });
        }

        // Increment in-degree of target node
        if (inDegree.has(targetId)) {
            inDegree.set(targetId, inDegree.get(targetId) + 1);
        }
    }
    // - Process instanceOf edges (instance -> class)
    for (const [instanceKey, instanceInfo] of instances) {
        const targetClass = instanceInfo.className;

        // Add edge to adjacency list
        if (adjacencyList.has(instanceKey)) {
            adjacencyList.get(instanceKey).push({
                target: targetClass,
                type: "instanceOf",
            });
        }

        // Increment in-degree
        if (inDegree.has(targetClass)) {
            inDegree.set(targetClass, inDegree.get(targetClass) + 1);
        }
    }

    const totalEdges = edges.length + instances.size;
    console.log(
        `  Built graph with ${totalEdges} edges (${edges.length} edges + ${instances.size} instanceOf)`,
    );
}

/**
 * Find root nodes (nodes with in-degree = 0)
 * @param {Map} inDegree - In-degree map
 * @returns {Array} Array of root node IDs
 */
function findRootNodes(inDegree) {
    // TODO: Find and return nodes with inDegree = 0
    const roots = [];
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) {
            roots.push(nodeId);
        }
    }

    return roots;
}

/**
 * Run BFS to calculate hierarchy levels
 * @param {Array} rootNodes - Array of root node IDs
 * @param {Map} adjacencyList - Adjacency list
 * @param {Map} inDegree - In-degree map
 * @param {Map} levels - Levels map to populate
 */
function runBFS(rootNodes, adjacencyList, inDegree, levels) {
    // - Initialize queue with root nodes
    const queue = [];
    for (const rootId of rootNodes) {
        queue.push(rootId);
        levels.set(rootId, 0);
    }

    let processedCount = 0;

    // - While queue is not empty:
    while (queue.length > 0) {
        //   - Dequeue current node
        const currentNode = queue.shift();
        const currentLevel = levels.get(currentNode);
        processedCount += 1;
        //   - Process neighbors
        const neighbors = adjacencyList.get(currentNode) || [];
        for (const neighbor of neighbors) {
            const targetId = neighbor.target;
            const newLevel = currentLevel + 1;

            //   - Update levels and in-degrees
            const existingLevel = levels.get(targetId) || 0;
            if (newLevel > existingLevel) {
                levels.set(targetId, newLevel);
            }
            const currentInDegree = inDegree.get(targetId);
            inDegree.set(targetId, currentInDegree - 1);

            // Enqueue if in-degree reaches 0
            if (inDegree.get(targetId) === 0) {
                queue.push(targetId);
                console.log(`     ${targetId} ready (inDegree=0)`);
            }
        }
        //   - Enqueue ready nodes (inDegree = 0)
    }
}

/**
 * Log hierarchy calculation results
 * @param {Map} levels - Calculated levels map
 */

function logResults(levels) {
    // Count nodes per level
    const levelCounts = new Map();
    for (const [nodeId, level] of levels) {
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
    }

    // Display level distribution
    console.log("  📊 Level distribution:");
    for (const [level, count] of [...levelCounts.entries()].sort(
        (a, b) => a[0] - b[0],
    )) {
        console.log(`    Level ${level}: ${count} nodes`);
    }
}
module.exports = {
    calculateHierarchyLevels,
};
