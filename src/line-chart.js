class LineChart {
  constructor(canvas, options, data = null) {
    this.canvas = canvas;
    this.canvasCtx = this.canvas.getContext('2d');
    this.setState({
      chartInitialized: true,
      chartOptions: Object.assign({
        xPadding: canvas.width / 100,
        yPadding: canvas.height / 100,
        lineColor: 'rgb(38,118,247)',
        lineWidth: canvas.width / 300,
        lineShadow: false,
        fillEnabled: false,
        fillColor: 'rgba(38,118,247,0.3)',
        crosshairColor: 'rgb(100,100,150)',
        crosshairWidth: canvas.width / 750,
        crosshairEnabled: true,
        crosshairEventEnabled: false,
        crosshairMouseLikeTouch: false,
        crosshairDashed: true,
        tooltipEnabled: true,
        tooltipSize: 1.25,
        tooltipFont: 'Roboto Mono',
        tooltipPrefix: '$ ',
        tooltipPostfix: '',
        labelFormatTimeEnabled: false,
        startAnimationEnabled: true,
        startAnimationSpeed: 30,
        debugMessagesEnabled: false,
      }, options),
    });
    if (this.state && this.state.chartOptions && this.state.chartOptions.debugMessagesEnabled && this.canvas && this.canvas.id) {
      console.info('LineChart id: ' + this.canvas.id + ' initialized');
    } else if (!this.canvas || (this.canvas && !this.canvas.id)) {
      console.warn('LineChart warning: canvas element should have some id! (some parts depends on it)');
    }
    this._handleInteractions();
    if (data) {
      this.setState({ chartData: data });
      this._calculateLowHigh(data.data);
      this._calculateStep(data);
      if (this.state.chartOptions.startAnimationEnabled) {
        this._startAnimation();
      } else {
        this._draw();
      }
    }
  }

  setData(data, animated = false) {
    this._calculateLowHigh(data.data);
    this._calculateStep(data);
    if (animated) {
      this._startAnimation();
    } else {
      this._draw();
    }
  }

  pushPoint(value, label) {
    let chartData = Object.assign({}, this.state.chartData);
    chartData.data.push(value);
    chartData.labels.push(label);
    this.setState({ chartData: chartData });
    this._calculateLowHigh(chartData.data);
    this._calculateStep(chartData);
    this._pushAnimation().then(() => { // todo: debug stepY update
      chartData = Object.assign({}, this.state.chartData);
      chartData.data.splice(0, 1);
      chartData.labels.splice(0, 1);
      this.setState({ chartData: chartData });
      this._draw();
    }).catch(error => console.warn('pushAnimation error', error));
  }

  listenForCrosshairUpdate(callback) {
    document.addEventListener('lineChartOnCrosshairUpdate-' + this.canvas.id, e => {
      callback ? callback(e.detail) : null;
    });
  }

  setState(newState) {
    if (this.state && this.state.chartOptions && this.state.chartOptions.debugMessagesEnabled) {
      console.info('LineChart id: ' + this.canvas.id + ' state update: old state', this.state);
    }
    this.state = Object.assign({}, this.state, newState);
    if (this.state && this.state.chartOptions && this.state.chartOptions.debugMessagesEnabled) {
      console.info('LineChart id: ' + this.canvas.id + ' state update: new state', this.state);
    }
  }

  getState() {
    return this.state;
  }

  _calculateStep(data) {
    let state = this.state;
    this.stepX = (this.canvas.width - (2 * state.chartOptions.xPadding)) / (data.data.length - 1);
    this.stepY = (this.canvas.height- (2 * state.chartOptions.yPadding)) / (state.high - state.low);
    return [this.stepX, this.stepY];
  }

  _calculateLowHigh(data) {
    let [low, high] = [9999999, 0];
    data.forEach(value => {
      if (Number(value) < low) { low = Number(value) }
      if (Number(value) > high) { high = Number(value) }
    });
    this.setState({ low: low, high: high });
  }

  _setMouseXAndDrawCrosshair(pixelX) {
    this.mouseX = pixelX * (this.canvas.width / this.canvas.scrollWidth);
    if (!this.isDrawing) {
      this._draw();
    }
  }

  _startAnimation() {
    if (!this.chartScaleY) {
      this.chartScaleY = 0.01;
    } else if (this.chartScaleY >= 0.999) {
      this.chartScaleY = 1;
      this._draw();
      if (this.animationFrameReqId) {
        window.cancelAnimationFrame(this.animationFrameReqId);
      }
      return;
    }
    this._draw();
    this.chartScaleY = this.chartScaleY + ((1 - this.chartScaleY) / this.state.chartOptions.startAnimationSpeed);
    this.animationFrameReqId = window.requestAnimationFrame(() => this._startAnimation());
  }

  _pushAnimation() {
    return new Promise(resolve => {
      if (!this.chartOffsetX) {
        this.chartOffsetX = this.stepX;
      } else if (this.chartOffsetX <= 0.001) {
        this.chartOffsetX = null;
        if (this.animationFrameReqId) {
          window.cancelAnimationFrame(this.animationFrameReqId);
        }
        return resolve(true);
      }
      this._draw();
      this.chartOffsetX = this.chartOffsetX + ((this.stepX - this.chartOffsetX) / this.state.chartOptions.startAnimationSpeed);
      this.animationFrameReqId = window.requestAnimationFrame(() => this._startAnimation());
    })
  }

  _draw() {
    this.isDrawing = true;
    let state = this.state;
    let crosshairY = null;
    let crosshairTitlePrice = null;
    let crosshairTitleTime = null;
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvasCtx.lineWidth = state.chartOptions.lineWidth;
    this.canvasCtx.strokeStyle = state.chartOptions.lineColor;
    this.canvasCtx.lineCap = 'round';
    this.canvasCtx.lineJoin = 'round';


    if (state.chartOptions.lineShadow) {
      this.canvasCtx.shadowOffsetX = state.chartOptions.lineWidth / 1.5;
      this.canvasCtx.shadowOffsetY = state.chartOptions.lineWidth / 1.5;
      this.canvasCtx.shadowColor = 'rgba(0,0,0,0.5)';
      this.canvasCtx.shadowBlur = 5;
    }

    this.canvasCtx.beginPath();
    this.canvasCtx.moveTo(state.chartOptions.xPadding, this.canvas.height - ((Number(state.chartData[0]) - state.low) * this.stepY) - state.chartOptions.yPadding);
    state.chartData.data.forEach((item, i) => {
      let y = 0;
      if (state.chartOptions.startAnimationEnabled) {
        y = this.canvas.height - (((Number(item) - state.low) * this.stepY) * this.chartScaleY) - state.chartOptions.yPadding;
      } else {
        y = this.canvas.height - ((Number(item) - state.low) * this.stepY) - state.chartOptions.yPadding;
      }
      let x = (this.stepX * i) + Number(state.chartOptions.xPadding);
      this.canvasCtx.lineTo(x, y);
      if (this.mouseX && (this.mouseX > x && this.mouseX < (x + this.stepX))) {
        const currentTitle = state.chartData.labels.filter((_, ti) => i === ti)[0];
        crosshairY = y;
        crosshairTitlePrice = state.chartOptions.tooltipPrefix + Number(item).toFixed(2) + state.chartOptions.tooltipPostfix;
        crosshairTitleTime = state.chartOptions.labelFormatTimeEnabled ? LineChart.formatTime(currentTitle) : currentTitle;
      }
    });
    this.canvasCtx.stroke();
    this.canvasCtx.closePath();

    if (state.chartOptions.fillEnabled) {
      this._fillChart();
    }

    if (
      state.chartOptions.crosshairEnabled
      && !this.hideCrosshair
      && this.mouseX
      && this.mouseX > state.chartOptions.xPadding + this.stepX
      && this.mouseX < (this.canvas.width - state.chartOptions.xPadding)
    ) {
      if (state.chartOptions.crosshairEventEnabled) {
        this._dispatchEvent(this.mouseX, crosshairTitleTime, crosshairTitlePrice);
      }

      if (state.chartOptions.lineShadow) {
        this.canvasCtx.shadowOffsetX = 0;
        this.canvasCtx.shadowOffsetY = 0;
        this.canvasCtx.shadowColor = 'rgba(0,0,0,0)';
        this.canvasCtx.shadowBlur = 0;
      }
      if (state.chartOptions.crosshairDashed) {
        this.canvasCtx.setLineDash([(this.canvas.width / 350), (this.canvas.width / 100)]);
      }
      this.canvasCtx.lineWidth = state.chartOptions.crosshairWidth;
      this.canvasCtx.strokeStyle = state.chartOptions.crosshairColor;
      this.canvasCtx.beginPath();
      this.canvasCtx.moveTo(this.mouseX, 0);
      this.canvasCtx.lineTo(this.mouseX, this.canvas.height);
      if (crosshairY > 0) {
        this.canvasCtx.moveTo(0, crosshairY);
        this.canvasCtx.lineTo(this.canvas.width, crosshairY);
      }
      this.canvasCtx.closePath();
      this.canvasCtx.stroke();
      if (crosshairTitlePrice && state.chartOptions.tooltipEnabled) {
        this.canvasCtx.fillStyle = 'rgba(255,255,255,0.6)';
        this.canvasCtx.fillRect(0, 0, (this.canvas.height / 20) * crosshairTitlePrice.length, state.chartOptions.yPadding * 10 * state.chartOptions.tooltipSize);
        this.canvasCtx.fillStyle = state.chartOptions.crosshairColor;
        this.canvasCtx.textAlign = 'left';
        this.canvasCtx.font = ((this.canvas.height / 25) * state.chartOptions.tooltipSize) + 'px ' + state.chartOptions.tooltipFont;
        this.canvasCtx.fillText(crosshairTitleTime, state.chartOptions.xPadding, (state.chartOptions.yPadding * 4));
        this.canvasCtx.font = 'bold ' + ((this.canvas.height / 15) * state.chartOptions.tooltipSize) + 'px ' + state.chartOptions.tooltipFont;
        this.canvasCtx.fillText(crosshairTitlePrice, state.chartOptions.xPadding, (state.chartOptions.yPadding * 4 * state.chartOptions.tooltipSize) + (this.canvas.height / 16));
      }
      if (state.chartOptions.crosshairDashed) {
        this.canvasCtx.setLineDash([0]);
      }
    }
    this.isDrawing = false;
  }

  _fillChart() {
    let state = this.state;
    this.canvasCtx.lineWidth = 0.1;
    this.canvasCtx.strokeStyle = state.chartOptions.fillColor;
    this.canvasCtx.lineCap = 'round';
    this.canvasCtx.lineJoin = 'round';

    this.canvasCtx.beginPath();
    this.canvasCtx.moveTo(state.chartOptions.xPadding + (state.chartOptions.lineWidth / 2), this.canvas.height - state.chartOptions.yPadding + state.chartOptions.lineWidth);
    this.canvasCtx.lineTo(state.chartOptions.xPadding, this.canvas.height - ((Number(state.chartData[0]) - state.low) * this.stepY) - state.chartOptions.yPadding + state.chartOptions.lineWidth);
    state.chartData.data.forEach((item, i) => {
      let y = 0;
      if (state.chartOptions.startAnimationEnabled) {
        y = this.canvas.height - (((Number(item) - state.low) * this.stepY) * this.chartScaleY) - state.chartOptions.yPadding;
      } else {
        y = this.canvas.height - ((Number(item) - state.low) * this.stepY) - state.chartOptions.yPadding;
      }
      let x = (this.stepX * i) + Number(state.chartOptions.xPadding);
      this.canvasCtx.lineTo(x, y);
    });
    this.canvasCtx.lineTo(this.canvas.width - state.chartOptions.xPadding, this.canvas.height - state.chartOptions.yPadding + state.chartOptions.lineWidth);
    this.canvasCtx.fillStyle = state.chartOptions.fillColor;
    this.canvasCtx.closePath();
    this.canvasCtx.fill();
    this.canvasCtx.stroke();
  }

  _handleInteractions() {
    this.canvas.onmousemove = e => {
      e.preventDefault();
      const pixelX = e.pageX - this.canvas.getBoundingClientRect().left;
      this._setMouseXAndDrawCrosshair(pixelX);
    };
    if (this.state.chartOptions.crosshairMouseLikeTouch) {
      this.hideCrosshair = true;
      this.canvas.onmousedown = e => {
        e.preventDefault();
        this.hideCrosshair = false;
        this._draw();
      };
      this.canvas.onmouseup = () => {
        this.hideCrosshair = true;
        this._draw();
        this._dispatchEvent(0, '', '');
      };
    } else {
      this.canvas.onmouseenter = () => {
        this.hideCrosshair = false;
        this._draw();
      };
      this.canvas.onmouseleave = () => {
        this.hideCrosshair = true;
        this._draw();
        this._dispatchEvent(0, '', '');
      };
    }
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.hideCrosshair = false;
      const pixelX = e.changedTouches[0].clientX - this.canvas.getBoundingClientRect().left;
      this._setMouseXAndDrawCrosshair(pixelX); // todo: touchstart anim
    });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const pixelX = e.changedTouches[0].clientX - this.canvas.getBoundingClientRect().left;
      this._setMouseXAndDrawCrosshair(pixelX);
    });
    this.canvas.addEventListener('touchend', () => {
      this.hideCrosshair = true;
      this._draw();
      this._dispatchEvent(0, '', '');
    });
  }

  _dispatchEvent(positionX, label, data) {
    const event = new CustomEvent('lineChartOnCrosshairUpdate-' + this.canvas.id, {
      detail: {
        positionX: positionX,
        label: label,
        data: data,
      }
    });
    document.dispatchEvent(event);
  }

  static formatTime(timeString, withYear = false) {
    const d = new Date(timeString);
    return ('0' + d.getDate()).slice(-2) + '.' + ('0'+(d.getMonth()+1)).slice(-2) + (withYear ? ('.' + d.getFullYear()) : '.')
      + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
}
