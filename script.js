const video = document.createElement('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function onOpenCvReady() {
  startCamera();
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => {
      video.srcObject = stream;
      video.setAttribute('playsinline', true); // required for iOS
      video.play();
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        processVideo();
      });
    })
    .catch((err) => {
      console.error('Error accessing camera:', err);
    });
}

function processVideo() {
  const src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
  const cap = new cv.VideoCapture(video);

  const process = () => {
    cap.read(src); // Read a frame from the video

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 150, 3);

    const lines = new cv.Mat();
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    for (let i = 0; i < lines.rows; ++i) {
      const startPoint = new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]);
      const endPoint = new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]);

      const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x) * 180 / Math.PI;

      if (angle > 85 && angle < 95) { // Filter for vertical lines
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    requestAnimationFrame(process);
  };

  requestAnimationFrame(process);
}
