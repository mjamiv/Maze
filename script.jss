// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Add a square (as a plane)
const squareGeometry = new THREE.PlaneGeometry(2, 2); // 2x2 units
const squareMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
const square = new THREE.Mesh(squareGeometry, squareMaterial);
square.position.set(-2, 0, 0); // Position it slightly to the left
scene.add(square);

// Add a circle (as a sphere for 3D effect)
const circleGeometry = new THREE.SphereGeometry(1, 32, 32); // Radius 1, 32 segments
const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const circle = new THREE.Mesh(circleGeometry, circleMaterial);
circle.position.set(2, 0, 0); // Position it slightly to the right
scene.add(circle);

// Position the camera
camera.position.z = 5;

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate the objects for some visual feedback
    square.rotation.y += 0.01;
    circle.rotation.y += 0.01;

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start the animation
animate();
