# line-chart.js

Simple line chart in ES6.

### Installation

Include line-chart.js in your document:
```
<script src="./path/to/line-chart.js"></script>
```

### Usage

* insert `canvas` element in document, set width and height:
```
<canvas id="chart" width="2000" height="600"></canvas>
```

* prepare data:
```
const chartData = {
  labels: ['foo', 'bar', 'baz'],
  data: [1, 3, 3],
}
```

* and chart options (with defaults):
```
const chartOptions = {
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
  startAnimationEnabled: true,
  startAnimationSpeed: 30, // 1 - x
}
```

* create chart:
```
const canvas = document.getElementById('chart')
const chart = new LineChart(canvas, chartOptions, chartData)
```

* eventually add new point:
```
chart.pushPoint(7, 'bazz')
```

* or set new data:
```
chart.setData(chartData)
```

* if `chartOptions.crosshairEnabled === true && chartOptions.crosshairEventEnabled === true` you can listen for tooltip update:
```
chart.listenForCrosshairUpdate(event => {
  // event = {
  //   positionX: crosshair X position
  //   label: label on position
  //   data: data on position
  // }
})
```

that's it ;)
