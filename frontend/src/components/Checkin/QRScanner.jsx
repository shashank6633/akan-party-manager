import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function QRScanner({ onScan, onClose }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { success, message, guest }
  const [error, setError] = useState('');
  const scannerRef = useRef(null);
  const containerRef = useRef(null);

  const startScanner = async () => {
    setError('');
    setResult(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Stop scanning while processing
          try {
            await scannerRef.current.stop();
          } catch (_) {}
          setScanning(false);

          // Call parent handler
          if (onScan) {
            try {
              const scanResult = await onScan(decodedText);
              setResult(scanResult);
            } catch (err) {
              setResult({ success: false, message: err.message || 'Scan processing failed.' });
            }
          }
        },
        () => {} // ignore errors during scanning
      );

      setScanning(true);
    } catch (err) {
      console.error('Scanner start error:', err);
      setError(
        err.toString().includes('NotAllowedError')
          ? 'Camera access denied. Please allow camera permission.'
          : err.toString().includes('NotFoundError')
          ? 'No camera found on this device.'
          : `Failed to start camera: ${err.message || err}`
      );
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
      }
    } catch (_) {}
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch (_) {}
      }
    };
  }, []);

  const handleScanAgain = () => {
    setResult(null);
    startScanner();
  };

  return (
    <div className="space-y-4">
      {/* Scanner viewport */}
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: 300 }}>
        <div id="qr-reader" ref={containerRef} className="w-full" />

        {!scanning && !result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90">
            <Camera className="w-12 h-12 text-gray-400 mb-3" />
            <button
              onClick={startScanner}
              className="px-6 py-2.5 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706] transition-colors"
            >
              Start Scanning
            </button>
            {error && (
              <p className="text-red-400 text-xs mt-3 text-center px-4">{error}</p>
            )}
          </div>
        )}
      </div>

      {/* Scan result */}
      {result && (
        <div className={`rounded-xl p-4 border ${result.success ? 'bg-green-50 border-green-200' : result.alreadyCheckedIn ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle className={`w-6 h-6 ${result.alreadyCheckedIn ? 'text-amber-500' : 'text-red-500'} shrink-0 mt-0.5`} />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold ${result.success ? 'text-green-800' : result.alreadyCheckedIn ? 'text-amber-800' : 'text-red-800'}`}>
                {result.message}
              </p>
              {result.guest && (
                <div className="mt-1 text-sm text-gray-600">
                  <p>Name: <strong>{result.guest.name}</strong></p>
                  {result.guest.checkedInAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      At: {new Date(result.guest.checkedInAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleScanAgain}
              className="flex-1 py-2 bg-[#af4408] text-white rounded-lg text-sm font-medium hover:bg-[#8e3706]"
            >
              Scan Next
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {scanning && (
        <div className="flex justify-center">
          <button
            onClick={stopScanner}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
          >
            <CameraOff className="w-4 h-4" /> Stop Scanner
          </button>
        </div>
      )}
    </div>
  );
}
