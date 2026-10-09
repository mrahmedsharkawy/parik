package com.bariqgifts.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val locationChannel = "com.bariqgifts.app/location"
    private val locationPermissionRequest = 7310
    private var pendingLocationResult: MethodChannel.Result? = null
    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, locationChannel)
            .setMethodCallHandler { call, result ->
                if (call.method == "getCurrentPosition") {
                    requestCurrentLocation(result)
                } else {
                    result.notImplemented()
                }
            }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "bariq_offers",
                "Bariq notifications",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Orders, offers and occasion reminders"
                enableVibration(true)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun requestCurrentLocation(result: MethodChannel.Result) {
        if (pendingLocationResult != null) {
            result.error("LOCATION_BUSY", "A location request is already running.", null)
            return
        }
        pendingLocationResult = result
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                locationPermissionRequest,
            )
            return
        }
        readCurrentLocation()
    }

    private fun readCurrentLocation() {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        locationManager = manager
        val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            .filter { provider -> runCatching { manager.isProviderEnabled(provider) }.getOrDefault(false) }
        if (providers.isEmpty()) {
            finishLocationError("LOCATION_DISABLED", "Enable Location Services and try again.")
            return
        }
        val last = providers.mapNotNull { provider ->
            runCatching {
                if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                ) manager.getLastKnownLocation(provider) else null
            }.getOrNull()
        }.maxByOrNull { it.time }
        if (last != null && System.currentTimeMillis() - last.time < 120_000) {
            finishLocation(last)
            return
        }
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) = finishLocation(location)
            override fun onProviderDisabled(provider: String) {}
            override fun onProviderEnabled(provider: String) {}
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        }
        locationListener = listener
        try {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                finishLocationError("LOCATION_DENIED", "Location permission was not granted.")
                return
            }
            manager.requestSingleUpdate(providers.first(), listener, mainLooper)
        } catch (error: Exception) {
            finishLocationError("LOCATION_UNAVAILABLE", error.message ?: "Location is unavailable.")
        }
    }

    private fun finishLocation(location: Location) {
        locationListener?.let { listener -> runCatching { locationManager?.removeUpdates(listener) } }
        locationListener = null
        pendingLocationResult?.success(mapOf("latitude" to location.latitude, "longitude" to location.longitude))
        pendingLocationResult = null
    }

    private fun finishLocationError(code: String, message: String) {
        locationListener?.let { listener -> runCatching { locationManager?.removeUpdates(listener) } }
        locationListener = null
        pendingLocationResult?.error(code, message, null)
        pendingLocationResult = null
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != locationPermissionRequest) return
        if (grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            readCurrentLocation()
        } else {
            finishLocationError("LOCATION_DENIED", "Location permission was not granted.")
        }
    }
}
