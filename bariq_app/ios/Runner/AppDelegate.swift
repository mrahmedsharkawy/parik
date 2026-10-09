import Flutter
import CoreLocation
import firebase_messaging
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate, CLLocationManagerDelegate {
  private let locationManager = CLLocationManager()
  private var pendingLocationResult: FlutterResult?
  private var locationChannel: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    FLTFirebaseMessagingPlugin.configureNotificationCenterDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    guard let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "BariqLocationPlugin") else {
      return
    }
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationChannel = FlutterMethodChannel(
      name: "com.bariqgifts.app/location",
      binaryMessenger: registrar.messenger()
    )
    locationChannel?.setMethodCallHandler { [weak self] call, result in
      guard call.method == "getCurrentPosition" else {
        result(FlutterMethodNotImplemented)
        return
      }
      self?.requestCurrentLocation(result)
    }
  }

  private func requestCurrentLocation(_ result: @escaping FlutterResult) {
    guard pendingLocationResult == nil else {
      result(FlutterError(code: "LOCATION_BUSY", message: "A location request is already running.", details: nil))
      return
    }
    pendingLocationResult = result
    switch locationManager.authorizationStatus {
    case .notDetermined:
      locationManager.requestWhenInUseAuthorization()
    case .authorizedAlways, .authorizedWhenInUse:
      locationManager.requestLocation()
    case .denied, .restricted:
      finishLocationError(code: "LOCATION_DENIED", message: "Location permission was not granted.")
    @unknown default:
      finishLocationError(code: "LOCATION_UNAVAILABLE", message: "Location is currently unavailable.")
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    guard pendingLocationResult != nil else { return }
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.requestLocation()
    case .denied, .restricted:
      finishLocationError(code: "LOCATION_DENIED", message: "Location permission was not granted.")
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else {
      finishLocationError(code: "LOCATION_UNAVAILABLE", message: "Location is currently unavailable.")
      return
    }
    pendingLocationResult?([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
    ])
    pendingLocationResult = nil
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finishLocationError(code: "LOCATION_UNAVAILABLE", message: error.localizedDescription)
  }

  private func finishLocationError(code: String, message: String) {
    pendingLocationResult?(FlutterError(code: code, message: message, details: nil))
    pendingLocationResult = nil
  }
}
