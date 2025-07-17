class AutoCalibratedMeasurementTool {
            constructor() {
                this.video = document.getElementById('video');
                this.canvas = document.getElementById('overlay');
                this.ctx = this.canvas.getContext('2d');
                this.currentMode = 'distance';
                this.currentUnit = 'cm';
                this.measurements = [];
                this.currentPoints = [];
                this.distanceCount = 0;
                this.maxDistances = 4;
                
                // Auto-calibration properties
                this.pixelsPerUnit = null;
                this.screenInfo = this.detectScreenInfo();
                
                this.initializeEventListeners();
                this.updateCanvasSize();
                this.performAutoCalibration();
                window.addEventListener('resize', () => this.updateCanvasSize());
            }

            detectScreenInfo() {
                
                const screenWidth = screen.width;
                const screenHeight = screen.height;
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                
                
                const dpr = window.devicePixelRatio || 1;
                
                
                let physicalWidth, physicalHeight;
                
                
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                
                if (isMobile) {
                    if (screenWidth <= 480) {
                        physicalWidth = 6.0; 
                        physicalHeight = 10.7; 
                    } else if (screenWidth <= 768) {
                        physicalWidth = 7.0; 
                        physicalHeight = 12.4; 
                    } else {
                        physicalWidth = 20.0; 
                        physicalHeight = 26.7; 
                    }
                } else {
                    
                    if (screenWidth <= 1366) {
                        physicalWidth = 29.0; 
                        physicalHeight = 16.3; 
                    } else if (screenWidth <= 1920) {
                        
                        physicalWidth = 47.6; 
                        physicalHeight = 26.8; 
                    } else {
                        
                        physicalWidth = 59.7; 
                        physicalHeight = 33.6; 
                    }
                }
                
                return {
                    screenWidth,
                    screenHeight,
                    windowWidth,
                    windowHeight,
                    dpr,
                    physicalWidth,
                    physicalHeight,
                    isMobile
                };
            }

            performAutoCalibration() {
                const pixelsPerCm = this.screenInfo.screenWidth / this.screenInfo.physicalWidth;
                const pixelsPerInch = pixelsPerCm * 2.54;
                
                const adjustedPixelsPerCm = pixelsPerCm / this.screenInfo.dpr;
                const adjustedPixelsPerInch = pixelsPerInch / this.screenInfo.dpr;
                
                this.calibrationFactors = {
                    cm: adjustedPixelsPerCm,
                    in: adjustedPixelsPerInch
                };
                
                this.updateCalibrationDisplay();
                this.updateStatus('Auto-calibration complete! Ready to measure.', 'success');
            }

            updateCalibrationDisplay() {
                const info = this.screenInfo;
                
                document.getElementById('screenSize').textContent = 
                    `${info.physicalWidth.toFixed(1)} × ${info.physicalHeight.toFixed(1)} cm`;
                
                document.getElementById('resolution').textContent = 
                    `${info.screenWidth} × ${info.screenHeight} px`;
                
                document.getElementById('pixelDensity').textContent = 
                    `${(info.screenWidth / info.physicalWidth).toFixed(1)} px/cm`;
                
                document.getElementById('scaleFactor').textContent = 
                    `1 px = ${(1 / this.calibrationFactors.cm).toFixed(4)} cm`;
            }

            initializeEventListeners() {
                document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
                document.getElementById('clearAll').addEventListener('click', () => this.clearAll());
                document.getElementById('recalibrate').addEventListener('click', () => this.recalibrate());
                
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
                });
                
                document.querySelectorAll('.unit-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.switchUnit(e.target.dataset.unit));
                });
                
                this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            }

            switchUnit(unit) {
                this.currentUnit = unit;
                
                document.querySelectorAll('.unit-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector(`[data-unit="${unit}"]`).classList.add('active');
                
                const factor = this.calibrationFactors[unit];
                document.getElementById('scaleFactor').textContent = 
                    `1 px = ${(1 / factor).toFixed(6)} ${unit}`;
                
                this.recalculateExistingMeasurements();
            }

            recalculateExistingMeasurements() {
                if (this.measurements.length > 0) {
                    this.updateStatus(`Unit changed to ${this.currentUnit}. Previous measurements cleared.`, 'info');
                    this.clearAll();
                }
            }

            async startCamera() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'environment' }
                    });
                    this.video.srcObject = stream;
                    this.video.onloadedmetadata = () => {
                        this.updateCanvasSize();
                        this.updateStatus('Camera started. Auto-calibration active. Start measuring!', 'success');
                    };
                } catch (error) {
                    this.updateStatus('Camera access denied or unavailable', 'warning');
                }
            }

            updateCanvasSize() {
                const rect = this.video.getBoundingClientRect();
                this.canvas.width = rect.width;
                this.canvas.height = rect.height;
                this.redrawAll();
            }

            handleCanvasClick(event) {
                const rect = this.canvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                
                this.currentPoints.push({ x, y });
                
                if (this.currentMode === 'distance') {
                    this.handleDistanceMode();
                } else if (this.currentMode === 'perimeter' || this.currentMode === 'area') {
                    this.handlePerimeterAreaMode();
                }
                
                this.redrawAll();
            }

            handleDistanceMode() {
                if (this.currentPoints.length === 2) {
                    if (this.distanceCount < this.maxDistances) {
                        const distance = this.calculateDistance(this.currentPoints[0], this.currentPoints[1]);
                        this.addMeasurement('Distance', distance);
                        this.distanceCount++;
                        this.updateDistanceCounter();
                    }
                    this.currentPoints = [];
                }
            }

            handlePerimeterAreaMode() {
                if (this.currentPoints.length >= 3) {
                    const firstPoint = this.currentPoints[0];
                    const lastPoint = this.currentPoints[this.currentPoints.length - 1];
                    const distance = Math.sqrt(
                        Math.pow(firstPoint.x - lastPoint.x, 2) + 
                        Math.pow(firstPoint.y - lastPoint.y, 2)
                    );
                    
                    if (distance < 20) {
                        this.calculatePolygonMeasurements();
                        this.currentPoints = [];
                    }
                }
            }

            calculateDistance(p1, p2) {
                const pixelDistance = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + 
                    Math.pow(p2.y - p1.y, 2)
                );
                
                const realDistance = pixelDistance / this.calibrationFactors[this.currentUnit];
                return realDistance;
            }

            calculatePolygonMeasurements() {
                if (this.currentPoints.length < 3) return;
                
                let perimeter = 0;
                for (let i = 0; i < this.currentPoints.length; i++) {
                    const p1 = this.currentPoints[i];
                    const p2 = this.currentPoints[(i + 1) % this.currentPoints.length];
                    perimeter += this.calculateDistance(p1, p2);
                }
                
                let area = 0;
                for (let i = 0; i < this.currentPoints.length; i++) {
                    const p1 = this.currentPoints[i];
                    const p2 = this.currentPoints[(i + 1) % this.currentPoints.length];
                    area += (p1.x * p2.y - p2.x * p1.y);
                }
                area = Math.abs(area) / 2;
                
                const unitFactor = this.calibrationFactors[this.currentUnit];
                area = area / (unitFactor * unitFactor);
                
                if (this.currentMode === 'perimeter') {
                    this.addMeasurement('Perimeter', perimeter);
                } else {
                    this.addMeasurement('Area', area, true);
                }
            }

            addMeasurement(type, value, isArea = false) {
                const unit = this.currentUnit;
                const displayUnit = isArea ? `${unit}²` : unit;
                const precision = isArea ? 6 : 3;
                
                this.measurements.push({
                    type,
                    value: value.toFixed(precision),
                    unit: displayUnit,
                    timestamp: new Date().toLocaleTimeString()
                });
                
                this.updateMeasurementsList();
            }

            updateMeasurementsList() {
                const list = document.getElementById('measurementsList');
                list.innerHTML = '';
                
                this.measurements.forEach((measurement, index) => {
                    const item = document.createElement('div');
                    item.className = 'measurement-item';
                    item.innerHTML = `
                        <div class="measurement-label">${measurement.type} #${index + 1}</div>
                        <div class="measurement-value">${measurement.value} ${measurement.unit}</div>
                        <div style="color: #88ccff; font-size: 10px; margin-top: 3px;">${measurement.timestamp}</div>
                    `;
                    list.appendChild(item);
                });
            }

            updateDistanceCounter() {
                const counter = document.getElementById('distanceCounter');
                counter.textContent = `Distance Measurements: ${this.distanceCount}/${this.maxDistances}`;
                
                if (this.distanceCount >= this.maxDistances) {
                    counter.style.background = 'rgba(255, 136, 0, 0.2)';
                    counter.style.color = '#ff8800';
                    counter.textContent += ' (Maximum reached)';
                }
            }

            switchMode(mode) {
                this.currentMode = mode;
                this.currentPoints = [];
                
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
                
                let statusText = '';
                switch (mode) {
                    case 'distance':
                        statusText = 'Distance Mode: Click two points to measure distance';
                        break;
                    case 'perimeter':
                        statusText = 'Perimeter Mode: Click points to form a polygon';
                        break;
                    case 'area':
                        statusText = 'Area Mode: Click points to form a polygon';
                        break;
                }
                
                this.updateStatus(statusText, 'info');
                this.redrawAll();
            }

            redrawAll() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.ctx.setLineDash([]);
                this.ctx.strokeStyle = '#0088ff';
                this.ctx.lineWidth = 2;
                
                this.currentPoints.forEach((point, index) => {
                    this.drawPoint(point.x, point.y, '#0088ff', 5);
                    
                    if (index > 0) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.currentPoints[index - 1].x, this.currentPoints[index - 1].y);
                        this.ctx.lineTo(point.x, point.y);
                        this.ctx.stroke();
                    }
                });
                
                if (this.currentPoints.length > 2 && (this.currentMode === 'perimeter' || this.currentMode === 'area')) {
                    this.ctx.strokeStyle = '#ff8800';
                    this.ctx.setLineDash([3, 3]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.currentPoints[this.currentPoints.length - 1].x, this.currentPoints[this.currentPoints.length - 1].y);
                    this.ctx.lineTo(this.currentPoints[0].x, this.currentPoints[0].y);
                    this.ctx.stroke();
                }
            }

            drawPoint(x, y, color, size) {
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x, y, size, 0, 2 * Math.PI);
                this.ctx.fill();
                
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 10;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }

            clearAll() {
                this.measurements = [];
                this.currentPoints = [];
                this.distanceCount = 0;
                this.updateMeasurementsList();
                this.updateDistanceCounter();
                this.redrawAll();
                this.updateStatus('All measurements cleared', 'info');
            }

            recalibrate() {
                this.performAutoCalibration();
                this.clearAll();
                this.updateStatus('Auto-calibration refreshed', 'success');
            }

            updateStatus(message, type) {
                const status = document.getElementById('mainStatus');
                status.textContent = message;
                status.className = `status ${type}`;
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            new AutoCalibratedMeasurementTool();
        });