// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Add OrbitControls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth movement
controls.dampingFactor = 0.05;

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040); // Soft white light
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Add square (plane)
const squareGeometry = new THREE.PlaneGeometry(2, 2);
const squareMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00, side: THREE.DoubleSide, shininess: 100 });
const square = new THREE.Mesh(squareGeometry, squareMaterial);
square.position.set(-2, 0, 0);
square.name = 'square'; // For identification
scene.add(square);

// Add circle (sphere)
const circleGeometry = new THREE.SphereGeometry(1, 32, 32);
const circleMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000, shininess: 100 });
const circle = new THREE.Mesh(circleGeometry, circleMaterial);
circle.position.set(2, 0, 0);
circle.name = 'circle';
scene.add(circle);

// Camera position
camera.position.set(0, 2, 5);
camera.lookAt(0, 0, 0);

// Raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedObject = null;

// Handle mouse movement (hover effect)
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([square, circle]);

    // Reset colors
    square.material.emissive.set(0x000000);
    circle.material.emissive.set(0x000000);

    if (intersects.length > 0) {
        intersects[0].object.material.emissive.set(0x333333); // Glow on hover
    }
}

// Handle mouse click (select and drag)
function onMouseDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([square, circle]);

    if (intersects.length > 0) {
        selectedObject = intersects[0].object;
        document.getElementById('info').innerText = `Selected: ${selectedObject.name}`;
        controls.enabled = false; // Disable orbit while dragging
    }
}

function onMouseUp() {
    selectedObject = null;
    controls.enabled = true;
    document.getElementById('info').innerText = 'Selected: None';
}

function onMouseDrag(event) {
    if (selectedObject) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([square, circle]);
        if (intersects.length > 0) {
            selectedObject.position.copy(intersects[0].point);
        }
    }
}

// Event listeners
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mouseup', onMouseUp);
window.addEventListener('mousemove', onMouseDrag);

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate objects slightly
    square.rotation.y += 0.01;
    circle.rotation.y += 0.01;

    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
