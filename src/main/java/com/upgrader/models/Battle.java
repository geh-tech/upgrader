package com.upgrader.models;

import java.sql.Timestamp;

public class Battle {
    private int id;
    private String type;
    private String status; // waiting, active, finished
    private Timestamp createdAt;

    public Battle() {}
    public Battle(String type, String status) {
        this.type = type;
        this.status = status;
    }

    // getters and setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Timestamp getCreatedAt() { return createdAt; }
    public void setCreatedAt(Timestamp createdAt) { this.createdAt = createdAt; }
}