import React, { useRef, useEffect } from 'react';
export default function SignaturePad({ value, onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const movedRef = useRef(false);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY, lineScale: (scaleX + scaleY) / 2 };
  }
  function start(event) {
    if (disabled || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d');
    const point = getPoint(event);
    drawingRef.current = true;
    movedRef.current = false;
    context.lineWidth = 2.4 * point.lineScale;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#172033';
    context.beginPath();
    context.moveTo(point.x, point.y);
  }
  function move(event) {
    if (!drawingRef.current || disabled) return;
    event.preventDefault();
    const context = canvasRef.current.getContext('2d');
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    movedRef.current = true;
  }
  function stop() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    // A tap alone leaves an empty canvas and is not a signature.
    if (movedRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  }
  function clear() {
    if (disabled) return;
    drawingRef.current = false;
    canvasRef.current.getContext('2d').clearRect(0, 0, 720, 220);
    onChange('');
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    let cancelled = false;
    if (!value) { context.clearRect(0, 0, canvas.width, canvas.height); return undefined; }
    const image = new Image();
    image.onload = () => {
      if (cancelled || drawingRef.current) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.src = value;
    return () => { cancelled = true; };
  }, [value]);
  return <div className="signature-pad-wrap">
    <div className="signature-pad-header"><strong>Signature preview / draw here</strong><button className="link-btn" type="button" disabled={disabled} onClick={clear}>Clear signature</button></div>
    <canvas ref={canvasRef} className="signature-pad" width="720" height="220" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} aria-label="Draw your signature, or use the typed signature button above" aria-disabled={disabled} />
  </div>;
}
