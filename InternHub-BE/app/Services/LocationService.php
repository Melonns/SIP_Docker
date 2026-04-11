<?php

namespace App\Services;

class LocationService
{
    /**
     * Radius bumi dalam meter
     */
    const EARTH_RADIUS = 6371000;

    /**
     * Hitung jarak antara dua koordinat menggunakan Haversine formula
     * 
     * @param float $lat1 Latitude titik 1
     * @param float $lon1 Longitude titik 1
     * @param float $lat2 Latitude titik 2
     * @param float $lon2 Longitude titik 2
     * @return float Jarak dalam meter
     */
    public static function calculateDistance($lat1, $lon1, $lat2, $lon2): float
    {
        // Konversi derajat ke radian
        $lat1Rad = deg2rad($lat1);
        $lat2Rad = deg2rad($lat2);
        $deltaLat = deg2rad($lat2 - $lat1);
        $deltaLon = deg2rad($lon2 - $lon1);

        // Haversine formula
        $a = sin($deltaLat / 2) * sin($deltaLat / 2) +
             cos($lat1Rad) * cos($lat2Rad) *
             sin($deltaLon / 2) * sin($deltaLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        // Jarak dalam meter
        return self::EARTH_RADIUS * $c;
    }

    /**
     * Cek apakah koordinat user berada dalam radius site
     * 
     * @param float $userLat Latitude user
     * @param float $userLon Longitude user
     * @param float $siteLat Latitude site
     * @param float $siteLon Longitude site
     * @param float $radiusMeter Radius yang dileave_requestskan dalam meter
     * @return array [isWithinRadius, distance]
     */
    public static function isWithinRadius($userLat, $userLon, $siteLat, $siteLon, $radiusMeter): array
    {
        $distance = self::calculateDistance($userLat, $userLon, $siteLat, $siteLon);

        return [
            'is_within_radius' => $distance <= $radiusMeter,
            'distance' => round($distance, 2),
            'radius_allowed' => $radiusMeter,
            'difference' => round($distance - $radiusMeter, 2)
        ];
    }

    /**
     * Validasi koordinat latitude dan longitude
     * 
     * @param float $latitude
     * @param float $longitude
     * @return bool
     */
    public static function isValidCoordinate($latitude, $longitude): bool
    {
        // Latitude: -90 sampai 90
        // Longitude: -180 sampai 180
        return $latitude >= -90 && $latitude <= 90 &&
               $longitude >= -180 && $longitude <= 180;
    }
}
