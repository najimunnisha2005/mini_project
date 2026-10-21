package com.sentrynet.dto;

public class AuthResponse {

    private Long id;
    private String displayName;
    private String email;
    private String token;

    public AuthResponse(
            Long id,
            String displayName,
            String email,
            String token) {
        this.id = id;
        this.displayName = displayName;
        this.email = email;
        this.token = token;
    }

    public Long getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEmail() {
        return email;
    }

    public String getToken() {
        return token;
    }
}
