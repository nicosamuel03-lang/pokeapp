import Capacitor
import AVFoundation
import UIKit

@objc(BarcodeScannerPlugin)
public class BarcodeScannerPlugin: CAPPlugin, AVCaptureMetadataOutputObjectsDelegate, CAPBridgedPlugin {
    public let identifier = "BarcodeScannerPlugin"
    public let jsName = "BarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]
    
    var captureSession: AVCaptureSession?
    var previewLayer: AVCaptureVideoPreviewLayer?
    var currentCall: CAPPluginCall?
    
    @objc func scan(_ call: CAPPluginCall) {
        currentCall = call
        DispatchQueue.main.async {
            self.startScanning()
        }
    }
    
    func startScanning() {
        let session = AVCaptureSession()
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device) else {
            currentCall?.reject("Camera not available")
            return
        }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
        output.metadataObjectTypes = [.ean13, .ean8]
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.frame = self.bridge?.viewController?.view.bounds ?? .zero
        previewLayer.videoGravity = .resizeAspectFill
        self.bridge?.viewController?.view.layer.addSublayer(previewLayer)
        self.previewLayer = previewLayer
        
        // Add a cancel button
        let cancelButton = UIButton(frame: CGRect(x: 20, y: 50, width: 80, height: 40))
        cancelButton.setTitle("Fermer", for: .normal)
        cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        cancelButton.layer.cornerRadius = 8
        cancelButton.tag = 999
        cancelButton.addTarget(self, action: #selector(cancelScan), for: .touchUpInside)
        self.bridge?.viewController?.view.addSubview(cancelButton)
        
        session.startRunning()
        self.captureSession = session
    }
    
    @objc func cancelScan() {
        stopScanning()
        currentCall?.resolve(["cancelled": true])
    }
    
    func stopScanning() {
        captureSession?.stopRunning()
        previewLayer?.removeFromSuperlayer()
        self.bridge?.viewController?.view.viewWithTag(999)?.removeFromSuperview()
    }
    
    public func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        if let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
           let code = obj.stringValue {
            stopScanning()
            currentCall?.resolve(["code": code])
        }
    }
}
