const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL non pris en charge, veuillez utiliser un navigateur compatible.');
}

// Vertex shader
const vertexShaderSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    uniform float u_rotation;
    uniform vec2 u_translation;
    void main() {
        vec2 rotatedPosition = vec2(
            a_position.x * cos(u_rotation) - a_position.y * sin(u_rotation),
            a_position.x * sin(u_rotation) + a_position.y * cos(u_rotation)
        );
        vec2 position = rotatedPosition + u_translation;
        vec2 zeroToOne = position / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
`;

// Fragment shader
const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() {
        gl_FragColor = u_color;
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Erreur de compilation des shaders', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Erreur de linkage du programme', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
const resolutionUniformLocation = gl.getUniformLocation(program, 'u_resolution');
const colorUniformLocation = gl.getUniformLocation(program, 'u_color');
const rotationUniformLocation = gl.getUniformLocation(program, 'u_rotation');
const translationUniformLocation = gl.getUniformLocation(program, 'u_translation');

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

gl.useProgram(program);

gl.enableVertexAttribArray(positionAttributeLocation);
gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);

let ship = { x: canvas.width / 2, y: canvas.height / 2, radius: 20, angle: 0, canShoot: true };
let fastBullet = false;
let bullets = [];
let asteroids = [];
let stars = [];
let score = 0;
let upPressed = false;
let explosions = [];
let asteroidColors = [
    [0.6, 0.6, 0.6, 1],
    [0.3, 0.3, 0.3, 1],
    [0.7, 0.7, 0.7, 1]
];
let niveau = 1;
let lives = 3;
let endGame = false;
let isBlinking = false;
let blinkCount = 0;

for (let i = 0; i < 100; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height
    });
}

function drawShip(x, y, radius, angle, color) {
    const shipColor = isBlinking ? [1, 0, 0, 1] : color;
    const vertices = new Float32Array([
        // Triangle principal
        0, -radius,
        radius / 2, radius,
        -radius / 2, radius,
        // Ailes
        -radius / 2, radius,
        -radius, radius / 2,
        -radius / 2, radius / 2,
        radius / 2, radius,
        radius, radius / 2,
        radius / 2, radius / 2,
        // Cockpit
        -radius / 4, 0,
        radius / 4, 0,
        0, -radius / 2
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, shipColor[0], shipColor[1], shipColor[2], shipColor[3]);
    gl.uniform1f(rotationUniformLocation, angle);
    gl.uniform2f(translationUniformLocation, x, y);
    gl.drawArrays(gl.TRIANGLES, 0, 3); // Triangle principal
    gl.drawArrays(gl.TRIANGLES, 3, 6); // Ailes
    gl.drawArrays(gl.TRIANGLES, 9, 3); // Cockpit

    // Dessiner le cercle bleu brillant autour du vaisseau
    drawCircle(x, y, radius * 2, [0, 0, 1, 0.5]);
}

function drawCircle(x, y, radius, color) {
    const numSegments = 50;
    const angleStep = (Math.PI * 2) / numSegments;
    const vertices = [];

    for (let i = 0; i <= numSegments; i++) {
        const angle = i * angleStep;
        vertices.push(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(rotationUniformLocation, 0);
    gl.uniform2f(translationUniformLocation, 0, 0);
    gl.drawArrays(gl.LINE_LOOP, 0, vertices.length / 2);
}

function drawSphere(x, y, radius, color) {
    const numSegments = 50;
    const angleStep = (Math.PI * 2) / numSegments;
    const vertices = [];

    for (let i = 0; i <= numSegments; i++) {
        const angle = i * angleStep;
        vertices.push(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(rotationUniformLocation, 0);
    gl.uniform2f(translationUniformLocation, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
}

function getRandomColor() {
    return asteroidColors[Math.floor(Math.random() * asteroidColors.length)];
}

function drawAsteroid(x, y, radius, color) {
    const numSegments = 48;
    const angleStep = (Math.PI * 2) / numSegments;
    const vertices = [];

    for (let i = 0; i <= numSegments; i++) {
        const angle = i * angleStep;
        const offset = 0;
        vertices.push(x + (radius + offset) * Math.cos(angle), y + (radius + offset) * Math.sin(angle));
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(rotationUniformLocation, 0);
    gl.uniform2f(translationUniformLocation, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
}

function drawRectangle(x, y, width, height, angle, color) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const vertices = [
        x, y,
        x + width * cos, y + width * sin,
        x - height * sin, y + height * cos,
        x - height * sin, y + height * cos,
        x + width * cos, y + width * sin,
        x + width * cos - height * sin, y + width * sin + height * cos
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(rotationUniformLocation, 0);
    gl.uniform2f(translationUniformLocation, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawStars(stars) {
    const starVertices = new Float32Array(stars.length * 12);
    stars.forEach((star, index) => {
        const offset = index * 12;
        starVertices.set([
            star.x, star.y,
            star.x + 2, star.y,
            star.x, star.y + 2,
            star.x, star.y + 2,
            star.x + 2, star.y,
            star.x + 2, star.y + 2
        ], offset);
    });
    gl.bufferData(gl.ARRAY_BUFFER, starVertices, gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, 1, 1, 1, 1); // Couleur blanche pour les étoiles
    gl.drawArrays(gl.TRIANGLES, 0, stars.length * 6);
}

function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement.textContent !== `Score: ${score}`) {
        scoreElement.textContent = `Score: ${score}`;
    }
}

function drawExplosion(x, y, radius, color, progress) {
    const numCircles = 5;
    for (let i = 0; i < numCircles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = progress * radius * Math.random();
        const offsetX = distance * Math.cos(angle);
        const offsetY = distance * Math.sin(angle);
        const circleRadius = radius * (1 - progress) * Math.random();
        drawSphere(x + offsetX, y + offsetY, circleRadius, color);
    }
}

asteroids.forEach(asteroid => {
    asteroid.particles = [];
});

function getRandomWarmColor() {
    const colors = [
        [1, 0, 0, 1],
        [1, 0.5, 0, 1],
        [1, 1, 0, 1]
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function drawParticles(particles) {
    particles.forEach(particle => {
        drawCircle(particle.x, particle.y, particle.radius, [particle.color[0], particle.color[1], particle.color[2], particle.alpha]);
    });
}

function drawHeart(x, y, size, color) {
    const vertices = [];
    const numSegments = 100;
    const angleStep = (Math.PI * 2) / numSegments;

    for (let i = 0; i <= numSegments; i++) {
        const angle = i * angleStep;
        const r = size * (16 * Math.sin(angle) ** 3);
        const s = size * (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
        vertices.push(x + r * 0.2, y - s * 0.2);
    }

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.uniform4f(colorUniformLocation, color[0], color[1], color[2], color[3]);
    gl.uniform1f(rotationUniformLocation, 0);
    gl.uniform2f(translationUniformLocation, 0, 0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, vertices.length / 2);
}


function displayScoreGain(scoreGain) {
    const scoreElement = document.createElement('div');
    scoreElement.textContent = `+${scoreGain}`;
    scoreElement.style.position = 'absolute';
    scoreElement.style.color = 'green';
    scoreElement.style.fontSize = '1.5em';
    scoreElement.style.left = `${50 + (Math.random() - 0.5) * 5}%`;
    scoreElement.style.top = `${50+ (Math.random() - 0.5) * 10}%`;
    scoreElement.style.transition = 'opacity 1s ease-out';
    scoreElement.style.opacity = '1';
    document.body.appendChild(scoreElement);

    setTimeout(() => {
        scoreElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(scoreElement);
        }, 1000);
    }, 1000);
}

function displayLifeGain(lifeGain) {
    const lifeElement = document.createElement('div');
    lifeElement.textContent = `+${lifeGain}`;
    lifeElement.style.position = 'absolute';
    lifeElement.style.color = 'red';
    lifeElement.style.fontSize = '2.5em';
    lifeElement.style.left = `${50 + (Math.random() - 0.5) * 5}%`;
    lifeElement.style.top = `${50+ (Math.random() - 0.5) * 10}%`;
    lifeElement.style.transition = 'opacity 1s ease-out';
    lifeElement.style.opacity = '1';
    document.body.appendChild(lifeElement);

    setTimeout(() => {
        lifeElement.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(lifeElement);
        }, 1000);
    }, 1000);
}

function displayGameOver() {
    if (endGame) return;
    const gameOverText = document.createElement('div');
    gameOverText.style.position = 'absolute';
    gameOverText.style.top = '50%';
    gameOverText.style.left = '50%';
    gameOverText.style.transform = 'translate(-50%, -50%)';
    gameOverText.style.color = 'red';
    gameOverText.style.fontSize = '3em';
    gameOverText.style.textAlign = 'center';
    gameOverText.style.padding = '20px';
    gameOverText.style.borderRadius = '10px';
    gameOverText.innerHTML = `Game Over<br>Score: ${score}<br>Appuyez sur [R] pour redémarrer`;
    document.body.appendChild(gameOverText);
    endGame = true;
}


function updateDifficulty() {
    const bulletSpeedIncrease = 1.5 * niveau;
    const asteroidSpawnRate = 0.015 + 0.005 * niveau;
    return { bulletSpeedIncrease, asteroidSpawnRate };
}

function displayLevelUpMessage(niveau) {
    const levelUpMessage = document.createElement('div');
    levelUpMessage.textContent = `Niveau ${niveau}`;
    levelUpMessage.style.position = 'absolute';
    levelUpMessage.style.top = '30%';
    levelUpMessage.style.left = '50%';
    levelUpMessage.style.transform = 'translate(-50%, -50%)';
    levelUpMessage.style.color = 'white';
    levelUpMessage.style.fontSize = '2em';
    levelUpMessage.style.fontFamily = 'Press Start 2P, cursive';
    levelUpMessage.style.transition = 'opacity 1s ease-out';
    levelUpMessage.style.opacity = '1';
    document.body.appendChild(levelUpMessage);

    setTimeout(() => {
        levelUpMessage.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(levelUpMessage);
        }, 1000);
    }, 1000);
}

function updateNiveau() {
    document.getElementById('niveau').textContent = `Niveau: ${niveau}`;
    displayLevelUpMessage(niveau);
}
function updateScene() {
    if (!endGame) {
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Dessiner les étoiles
        stars.forEach((star) => {
            star.y += 2 * (niveau);
            if (star.y > canvas.height) {
                star.y = 0;
                star.x = Math.random() * canvas.width;
            }

        });
        drawStars(stars);
        // Dessiner le vaisseau
        drawShip(ship.x, ship.y, ship.radius, ship.angle, [0, 0.6, 0.9, 1]);

        // Dessiner les balles
        bullets.forEach((bullet, index) => {
            bullet.x += bullet.dx;
            bullet.y += bullet.dy;
            drawRectangle(bullet.x, bullet.y, bullet.width, bullet.height, bullet.angle, [1, 0, 0, 1]);

            // Supprimer les balles hors de l'écran
            if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
                bullets.splice(index, 1);
            }
        });

        // Dessiner les astéroïdes
        asteroids.forEach((asteroid, index) => {
            asteroid.x += asteroid.dx;
            asteroid.y += asteroid.dy;

            // Générer des particules
            asteroid.particles.push({
                x: asteroid.x,
                y: asteroid.y,
                radius: Math.random() * 3 + 1,
                color: getRandomWarmColor(),
                alpha: 1,
                dx: (Math.random() - 0.5) * 2,
                dy: (Math.random() - 0.5) * 2
            });

            // Mettre à jour et dessiner les particules
            asteroid.particles.forEach((particle, particleIndex) => {
                particle.x += particle.dx;
                particle.y += particle.dy;
                particle.alpha -= 0.04;
                if (particle.alpha <= 0) {
                    asteroid.particles.splice(particleIndex, 1);
                }
            });

            drawParticles(asteroid.particles);

            drawAsteroid(asteroid.x, asteroid.y, asteroid.radius, asteroid.color);

            // Vérifier les collisions avec les balles
            bullets.forEach((bullet, bulletIndex) => {
                const dist = Math.hypot(bullet.x - asteroid.x, bullet.y - asteroid.y);
                if (dist < asteroid.radius) {
                    asteroid.hits--;
                    bullets.splice(bulletIndex, 1);
                    if (asteroid.hits <= 0) {
                        const scoreGain = asteroid.score;
                        score += scoreGain;
                        updateScore();
                        if (asteroid.type === 'heart') {
                            lives += 1;
                            displayLifeGain('♥');
                        }else if (asteroid.type === 'raffale') {
                            fastBullet = true;
                            setTimeout(() => fastBullet = false, 10000);
                        }
                        displayScoreGain(scoreGain);
                        explosions.push({x: asteroid.x, y: asteroid.y, radius: asteroid.radius, color: asteroid.color, progress: 0});
                        asteroids.splice(index, 1);
                    }
                }
            });

            // Vérifier les collisions avec le cercle bleu
            const distToShip = Math.hypot(ship.x - asteroid.x, ship.y - asteroid.y);
            if (distToShip < ship.radius * 2 + asteroid.radius) {
                explosions.push({x: asteroid.x, y: asteroid.y, radius: asteroid.radius, color: asteroid.color ,  progress: 0});
                asteroids.splice(index, 1);
                lives -= 1;
                isBlinking = true;
                blinkCount = 0;
            }

            // Supprimer les astéroïdes hors de l'écran
            if (asteroid.x < 0 || asteroid.x > canvas.width || asteroid.y < 0 || asteroid.y > canvas.height) {
                asteroids.splice(index, 1);
            }
        });

        // Dessiner les explosions
        explosions.forEach((explosion, index) => {
            drawExplosion(explosion.x, explosion.y, explosion.radius, explosion.color, explosion.progress);
            explosion.progress += 0.05;
            if (explosion.progress > 1) {
                explosions.splice(index, 1);
            }
        });

        // Gérer le clignotement du vaisseau
        if (isBlinking) {
            blinkCount++;
            if (blinkCount > 20) {
                isBlinking = false;
            }
        }

        // Tirer des balles
        if (upPressed && ship.canShoot) {
            const { bulletSpeedIncrease } = updateDifficulty();
            const bulletSpeed = 10 + bulletSpeedIncrease;
            const bulletX = ship.x + ship.radius * Math.cos(ship.angle - Math.PI / 2);
            const bulletY = ship.y + ship.radius * Math.sin(ship.angle - Math.PI / 2);
            const bullet = {
                x: bulletX,
                y: bulletY,
                width: 5,
                height: 15,
                dx: bulletSpeed * Math.cos(ship.angle - Math.PI / 2),
                dy: bulletSpeed * Math.sin(ship.angle - Math.PI / 2),
                angle: ship.angle
            };
            bullets.push(bullet);
            ship.canShoot = false;
            if (fastBullet) {
                setTimeout(() => ship.canShoot = true, 25);
            } else {
                setTimeout(() => ship.canShoot = true, 200 - bulletSpeedIncrease);
            }
        }

        // Ajouter des astéroïdes
        const { asteroidSpawnRate } = updateDifficulty();
        if (Math.random() < asteroidSpawnRate) {
            const speed = Math.sqrt(niveau) + Math.random() * 2;
            const asteroid = chooseTypeAsteroid();

            const angle = Math.atan2(ship.y - asteroid.y, ship.x - asteroid.x);
            asteroid.dx = speed * Math.cos(angle);
            asteroid.dy = speed * Math.sin(angle);
            asteroids.push(asteroid);
        }

        // Dessiner les coeurs
        for (let i = 0; i < lives; i++) {
            drawHeart(20 + i * 40, 20, 5, [1, 0, 0, 1]);
        }

        const paliersNiveaux = [500, 1500, 3000, 5000, 7500, 10500, 14000, 18000, 22500, 27500, 33000, 39000, 45500, 52500, 60000];
        if (score >= paliersNiveaux[niveau - 1]) {
            niveau++;
            lives++;
            displayLifeGain('♥');
            updateNiveau();
        }
    }

    if (lives <= 0) {
        displayGameOver();
    }
    requestAnimationFrame(updateScene);
}

function chooseTypeAsteroid() {
    const random = Math.random();
    let asteroid = {
        x: Math.random() < 0.5 ? 0 : canvas.width,
        y: Math.random() * canvas.height,
        radius: 20 + Math.random() * 30,
        type: 'null',
        color: [1,1,1,1],
        hits: 0,
        score: 0,
        particles: []
    };
    if (random < 0.95 - (niveau * 0.005)) {
        asteroid.type = 'classic';
        asteroid.color = getRandomColor();
        asteroid.hits = 1;
        asteroid.score = 10;
        return asteroid;
    }else if (random < 0.98 - (niveau * 0.005)) {
        asteroid.type = 'bad';
        asteroid.color = [0.560784314, 0.125490196, 0.094117647, 1];
        asteroid.hits = 3;
        asteroid.score = 30;
        return asteroid;
    } else if (random < 0.985 - (niveau * 0.002)) {
        asteroid.type = 'good';
        asteroid.color = [0.196078431, 0.803921569, 0.196078431, 1];
        asteroid.hits = 2;
        asteroid.score = 20;
        return asteroid;
    } else if (random < 0.99 - (niveau * 0.001) ) {
        asteroid.type = 'raffale';
        asteroid.color = [0.8, 0.8, 0.2, 1];
        asteroid.hits = 3;
        asteroid.score = 0;
        return asteroid;
    } else if (random < 0.995 - (niveau * 0.001)) {
            asteroid.type = 'heart';
            asteroid.color = [0, 1, 0, 1];
            asteroid.hits = 3;
            asteroid.score = 0;
            return asteroid;
    }else {
            asteroid.type = 'ultime';
            asteroid.color = [0, 0, 0.5, 1];
            asteroid.hits = 5;
            asteroid.score = 100;
            return asteroid;
        }
}

document.addEventListener('keydown', (e) => {
    if (e.key === ' ') upPressed = true;
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        document.location.reload();
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === ' ') upPressed = false;
});
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const dx = mouseX - ship.x;
    const dy = mouseY - ship.y;
    ship.angle = Math.atan2(dy, dx) + Math.PI / 2;
});

gl.clearColor(0, 0, 0, 1);


function displayWelcomeScreen() {
    const welcomeScreen = document.createElement('div');
    welcomeScreen.id = 'welcome-screen';
    welcomeScreen.style.position = 'absolute';
    welcomeScreen.style.top = '50%';
    welcomeScreen.style.left = '50%';
    welcomeScreen.style.transform = 'translate(-50%, -50%)';
    welcomeScreen.style.color = 'white';
    welcomeScreen.style.fontSize = '2em';
    welcomeScreen.style.textAlign = 'center';
    welcomeScreen.style.padding = '20px';
    welcomeScreen.style.border = '2px solid white';
    welcomeScreen.style.borderRadius = '10px';
    welcomeScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    welcomeScreen.innerHTML = `<p>Bienvenue</p><p>Appuyez sur <strong>\u23CE</strong> pour démarrer</p>`;
    document.body.appendChild(welcomeScreen);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.body.removeChild(welcomeScreen);
            startGame();
        }
    });
}

function startGame() {
    updateScene();
}

displayWelcomeScreen();

