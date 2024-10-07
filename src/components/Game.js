import React, { useState, useEffect, useCallback } from "react";
import "./Game.css"; // Make sure to create this CSS file

// List of major US cities with good Street View coverage
const majorCities = [
	{ lat: 40.7128, lng: -74.006 }, // New York
	{ lat: 34.0522, lng: -118.2437 }, // Los Angeles
	{ lat: 41.8781, lng: -87.6298 }, // Chicago
	{ lat: 29.7604, lng: -95.3698 }, // Houston
	{ lat: 33.749, lng: -84.388 }, // Atlanta
	// Add more cities as needed
];

function Game() {
	const [image, setImage] = useState("");
	const [score, setScore] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [currentLocation, setCurrentLocation] = useState(null);
	const [guess, setGuess] = useState("");
	const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
	const [lastGuessResult, setLastGuessResult] = useState(null);
	const [correctLocationName, setCorrectLocationName] = useState("");
	const [guessCount, setGuessCount] = useState(0); // Added for skip feature
	const [MAX_GUESSES, setMAX_GUESSES] = useState(10); // Added for skip feature

	useEffect(() => {
		console.log("API Key:", process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
		// Load Google Maps JavaScript API
		const loadGoogleMapsApi = () => {
			const script = document.createElement("script");
			script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
			script.async = true;
			script.defer = true;
			script.onload = () => setGoogleMapsLoaded(true);
			script.onerror = (error) => {
				console.error("Error loading Google Maps API:", error);
				console.log("API Key used:", process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
			};
			document.head.appendChild(script);
		};

		if (!window.google) {
			loadGoogleMapsApi();
		} else {
			setGoogleMapsLoaded(true);
		}

		return () => {
			const script = document.querySelector(
				'script[src^="https://maps.googleapis.com/maps/api/js"]'
			);
			if (script) {
				document.head.removeChild(script);
			}
		};
	}, []);

	const fetchRandomLocation = useCallback(async () => {
		setLoading(true);
		setError(null);

		const maxAttempts = 5; // Increased number of attempts
		let attempts = 0;

		while (attempts < maxAttempts) {
			let lat, lng;

			if (Math.random() < 0.7) {
				// 70% chance to use a major city
				const randomCity =
					majorCities[Math.floor(Math.random() * majorCities.length)];
				lat = randomCity.lat + (Math.random() - 0.5) * 0.1; // Add some randomness
				lng = randomCity.lng + (Math.random() - 0.5) * 0.1;
			} else {
				// Generate random coordinates within continental USA
				lat = (Math.random() * (49.3457868 - 24.7433195) + 24.7433195).toFixed(
					6
				);
				lng = (Math.random() * (-66.9513812 - -125.0) + -125.0).toFixed(6);
			}

			const fov = 80;
			const heading = Math.floor(Math.random() * 360); // Random heading
			const pitch = 0;

			// Fetch the Street View image
			const apiKey = "AIzaSyA2IGLRPgdr5zahKCBsdB9p_-nzDWoR-PA"; // Replace with your actual Google API key
			const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&fov=${fov}&heading=${heading}&pitch=${pitch}&key=${apiKey}`;

			try {
				console.log("Fetching image from:", imageUrl);
				const response = await fetch(imageUrl);
				console.log("Response status:", response.status);

				if (response.ok) {
					const blob = await response.blob();
					// Check if the image is the default "no imagery" image
					if (blob.size > 5000) {
						// Assuming the "no imagery" image is smaller than 5KB
						const objectUrl = URL.createObjectURL(blob);
						setImage(objectUrl);
						setLoading(false);
						setCurrentLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
						const geocoder = new window.google.maps.Geocoder();
						geocoder.geocode(
							{ location: { lat: parseFloat(lat), lng: parseFloat(lng) } },
							(results, status) => {
								if (status === "OK") {
									if (results[0]) {
										setCorrectLocationName(results[0].formatted_address);
									} else {
										setCorrectLocationName("Unknown location");
									}
								} else {
									setCorrectLocationName("Unknown location");
								}
							}
						);
						return; // Successfully found an image, exit the function
					}
				}
			} catch (e) {
				console.error("Error fetching image:", e);
			}

			attempts++;
		}

		// If we've exhausted all attempts
		setError(
			"Failed to find a location with Street View imagery. Please try again."
		);
		setLoading(false);
	}, []);

	useEffect(() => {
		if (googleMapsLoaded) {
			fetchRandomLocation();
		}
	}, [fetchRandomLocation, googleMapsLoaded]);

	const handleGuess = () => {
		if (!googleMapsLoaded) {
			setError("Google Maps is still loading. Please wait.");
			return;
		}

		const service = new window.google.maps.places.PlacesService(
			document.createElement("div")
		);
		service.findPlaceFromQuery(
			{
				query: guess,
				fields: ["geometry"],
			},
			(results, status) => {
				if (
					status === window.google.maps.places.PlacesServiceStatus.OK &&
					results.length > 0
				) {
					const guessLocation = {
						lat: results[0].geometry.location.lat(),
						lng: results[0].geometry.location.lng(),
					};
					const distance = calculateDistance(currentLocation, guessLocation);
					const points = calculatePoints(distance);

					setScore((prevScore) => prevScore + points);
					setLastGuessResult({
						distance: distance.toFixed(2),
						points: points,
						correctLocation: correctLocationName,
					});
					fetchRandomLocation(); // Fetch a new location after guessing
					setGuess(""); // Clear the input field
				} else {
					setError(
						"Unable to find the location you entered. Please try again."
					);
				}
			}
		);
	};

	const handleSkip = () => {
		setGuessCount(0); // Reset guess count
		fetchRandomLocation(); // Fetch a new location
	};

	const calculateDistance = (loc1, loc2) => {
		const R = 6371; // Radius of the Earth in km
		const dLat = ((loc2.lat - loc1.lat) * Math.PI) / 180;
		const dLon = ((loc2.lng - loc1.lng) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((loc1.lat * Math.PI) / 180) *
				Math.cos((loc2.lat * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return R * c; // Distance in km
	};

	const calculatePoints = (distance) => {
		if (distance < 10) return 100;
		if (distance < 50) return 75;
		if (distance < 100) return 50;
		if (distance < 500) return 25;
		return 10;
	};

	return (
		<div className="game">
			{loading && <p className="loading">Loading... Please wait.</p>}
			{error && <p className="error">{error}</p>}
			{image && (
				<img src={image} alt="Street View" className="street-view-image" />
			)}
			<div className="game-controls">
				<input
					type="text"
					value={guess}
					onChange={(e) => setGuess(e.target.value)}
					placeholder="Enter your guess"
					className="guess-input"
				/>
				<button onClick={handleGuess} className="submit-button">
					Submit Guess
				</button>
				<button onClick={handleSkip} className="skip-button">
					Skip Location
				</button>
			</div>
			<div className="game-info">
				<p>
					Guess {guessCount + 1}/{MAX_GUESSES}
				</p>
				<p>Score: {score}</p>
			</div>
			{lastGuessResult && (
				<div className="last-guess-result">
					<p>
						Your last guess was {lastGuessResult.distance} km away from{" "}
						{lastGuessResult.correctLocation}.
					</p>
					<p>You earned {lastGuessResult.points} points!</p>
				</div>
			)}
		</div>
	);
}

export default Game;
