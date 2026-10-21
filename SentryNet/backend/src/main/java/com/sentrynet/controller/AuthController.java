
package com.sentrynet.controller;

import com.sentrynet.dto.AuthResponse;
import com.sentrynet.dto.LoginRequest;
import com.sentrynet.dto.RegisterRequest;
import com.sentrynet.model.User;
import com.sentrynet.service.AuthService;
import com.sentrynet.service.JwtService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    public AuthController(
            AuthService authService,
            JwtService jwtService) {
        this.authService = authService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {

        User user = authService.register(
                request.getDisplayName(),
                request.getEmail(),
                request.getPassword());

        String token = jwtService.generateToken(user.getEmail());

        AuthResponse response = new AuthResponse(
                user.getId(),
                user.getDisplayName(),
                user.getEmail(),
                token);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request) {

        User user = authService.authenticate(
                request.getEmail(),
                request.getPassword());

        String token = jwtService.generateToken(user.getEmail());

        AuthResponse response = new AuthResponse(
                user.getId(),
                user.getDisplayName(),
                user.getEmail(),
                token);

        return ResponseEntity.ok(response);
    }
}
