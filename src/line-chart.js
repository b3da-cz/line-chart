class LineChartStore {
  static setState(newState) {
    LineChartStore.state = Object.assign({}, LineChartStore.state, newState);
    console.warn('LineChartStore:state update', LineChartStore.state);
    return LineChartStore.state;
  }

  static getState() {
    return LineChartStore.state;
  }
}


class LineChart {
  constructor(canvas, options, data = null) {
    LineChartStore.setState({
      chartInitialized: true,
      chartOptions: Object.assign({}, options, {
        xPadding: canvas.width / 100,
        yPadding: canvas.width / 100,
        lineColor: 'rgb(38,118,247)',
        lineWidth: canvas.width / 300,
        lineShadow: false,
        crosshairColor: 'rgb(100,100,150)',
        crosshairWidth: canvas.width / 750,
        crosshairEnabled: true,
        crosshairDashed: true,
        tooltipEnabled: true,
        tooltipSize: 1.25,
        tooltipFont: 'Roboto Mono',
        tooltipPrefix: '$ ',
        tooltipPostfix: '',
        startAnimationEnabled: true,
        startAnimationSpeed: 10,
      }),
    });
    this.canvas = canvas;
    this.canvasCtx = this.canvas.getContext('2d');
    this.canvas.onmousemove = (e) => {
      const pixelX = e.pageX - this.canvas.offsetLeft;
      this._setMouseXAndDrawCrosshair(pixelX);
    };
    this.canvas.addEventListener('touchstart', (e) => {
      const pixelX = e.changedTouches[0].clientX - this.canvas.offsetLeft;
      this._setMouseXAndDrawCrosshair(pixelX); // todo: touchstart anim
    });
    this.canvas.addEventListener('touchmove', (e) => {
      const pixelX = e.changedTouches[0].clientX - this.canvas.offsetLeft;
      this._setMouseXAndDrawCrosshair(pixelX);
    });
    this.canvas.addEventListener('touchend', (e) => {
      const pixelX = e.changedTouches[0].clientX - this.canvas.offsetLeft;
      this._setMouseXAndDrawCrosshair(pixelX); // todo: touchend anim
    });
    if (data) {
      LineChartStore.setState({ chartData: data });
      this._calculateLowHigh(data.data);
      this._calculateStep(data);
      if (LineChartStore.getState().chartOptions.startAnimationEnabled) {
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
    let chartData = Object.assign({}, LineChartStore.getState().chartData);
    chartData.data.push(value);
    chartData.labels.push(label);
    LineChartStore.setState({ chartData: chartData });
    this._calculateLowHigh(chartData.data);
    this._calculateStep(chartData);
    this._pushAnimation().then(() => { // todo: debug stepY update
      chartData = Object.assign({}, LineChartStore.getState().chartData);
      chartData.data.splice(0, 1);
      chartData.labels.splice(0, 1);
      LineChartStore.setState({ chartData: chartData });
      this._draw();
    }).catch(error => console.warn('pushAnimation error', error));
  }

  _calculateStep(data) {
    let state = LineChartStore.getState();
    this.stepX = (this.canvas.width - (2 * state.chartOptions.xPadding)) / data.data.length;
    this.stepY = (this.canvas.height- (2 * state.chartOptions.yPadding)) / (state.high - state.low);
    return [this.stepX, this.stepY];
  }

  _calculateLowHigh(data) {
    let [low, high] = [9999999, 0];
    data.forEach(value => {
      if (Number(value) < low) { low = Number(value) }
      if (Number(value) > high) { high = Number(value) }
    });
    LineChartStore.setState({ low: low, high: high });
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
    // this.chartScaleY = this.chartScaleY + (this.chartScaleY / 7); // speed up
    this.chartScaleY = this.chartScaleY + ((1 - this.chartScaleY) / LineChartStore.getState().chartOptions.startAnimationSpeed);
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
      this.chartOffsetX = this.chartOffsetX + ((this.stepX - this.chartOffsetX) / LineChartStore.getState().chartOptions.startAnimationSpeed);
      this.animationFrameReqId = window.requestAnimationFrame(() => this._startAnimation());
    })
  }

  _draw() {
    this.isDrawing = true;
    let state = LineChartStore.getState();
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
      let x = (this.stepX * (i + 1)) + Number(state.chartOptions.xPadding);
      this.canvasCtx.lineTo(x, y);
      if (this.mouseX && (this.mouseX > x && this.mouseX < (x + this.stepX))) {
        crosshairY = y;
        crosshairTitlePrice = state.chartOptions.tooltipPrefix + Number(item).toFixed(2) + state.chartOptions.tooltipPostfix;
        crosshairTitleTime = LineChart.formatTime(state.chartData.labels.filter((_, ti) => i === ti)[0]);
      }
    });
    this.canvasCtx.stroke();
    this.canvasCtx.closePath();

    if (
      state.chartOptions.crosshairEnabled
      && this.mouseX
      && this.mouseX > state.chartOptions.xPadding + this.stepX
      && this.mouseX < (this.canvas.width - state.chartOptions.xPadding)
    ) {
      if (state.chartOptions.lineShadow) {
        this.canvasCtx.shadowOffsetX = 0;
        this.canvasCtx.shadowOffsetY = 0;
        this.canvasCtx.shadowColor = 'rgba(0,0,0,0)';
        this.canvasCtx.shadowBlur = 0;
      }
      if (state.chartOptions.crosshairDashed) {
        this.canvasCtx.setLineDash([(this.canvas.width / 500), (this.canvas.width / 200)]);
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
      if (crosshairTitlePrice) {
        this.canvasCtx.fillStyle = state.chartOptions.crosshairColor;
        this.canvasCtx.textAlign = 'left';
        this.canvasCtx.font = ((this.canvas.height / 25) * state.chartOptions.tooltipSize) + 'px ' + state.chartOptions.tooltipFont;
        this.canvasCtx.fillText(crosshairTitleTime, state.chartOptions.xPadding, (state.chartOptions.yPadding * 2));
        this.canvasCtx.font = 'bold ' + ((this.canvas.height / 15) * state.chartOptions.tooltipSize) + 'px ' + state.chartOptions.tooltipFont;
        this.canvasCtx.fillText(crosshairTitlePrice, state.chartOptions.xPadding, (state.chartOptions.yPadding * 2 * state.chartOptions.tooltipSize) + (this.canvas.height / 16));
      }
      this.canvasCtx.stroke();
      this.canvasCtx.closePath();
      if (state.chartOptions.crosshairDashed) {
        this.canvasCtx.setLineDash([0]);
      }
    }
    this.isDrawing = false;
  }

  static formatTime(timeString, withYear = false) {
    const d = new Date(timeString);
    return ('0' + d.getDate()).slice(-2) + '.' + ('0'+(d.getMonth()+1)).slice(-2) + (withYear ? ('.' + d.getFullYear()) : '.')
      + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }
}
