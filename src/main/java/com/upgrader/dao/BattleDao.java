package com.upgrader.dao;

import com.upgrader.config.Database;
import com.upgrader.models.Battle;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class BattleDao {
    public static int createBattle(String type, String status) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO battles (type, status) VALUES (?, ?)", Statement.RETURN_GENERATED_KEYS)) {
            stmt.setString(1, type);
            stmt.setString(2, status);
            stmt.executeUpdate();
            ResultSet rs = stmt.getGeneratedKeys();
            if (rs.next()) return rs.getInt(1);
        } catch (SQLException e) { e.printStackTrace(); }
        return -1;
    }

    public static void addParticipant(int battleId, int userId, int team, String status) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO battle_participants (battle_id, user_id, team, status) VALUES (?, ?, ?, ?)")) {
            stmt.setInt(1, battleId);
            stmt.setInt(2, userId);
            stmt.setInt(3, team);
            stmt.setString(4, status);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static void updateParticipantStatus(int battleId, int userId, String status) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "UPDATE battle_participants SET status = ? WHERE battle_id = ? AND user_id = ?")) {
            stmt.setString(1, status);
            stmt.setInt(2, battleId);
            stmt.setInt(3, userId);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static Battle getBattle(int battleId) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM battles WHERE id = ?")) {
            stmt.setInt(1, battleId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                Battle b = new Battle();
                b.id = rs.getInt("id");
                b.type = rs.getString("type");
                b.status = rs.getString("status");
                b.createdAt = rs.getTimestamp("created_at");
                return b;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static List<Integer> getParticipants(int battleId) {
        List<Integer> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT user_id FROM battle_participants WHERE battle_id = ?")) {
            stmt.setInt(1, battleId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) list.add(rs.getInt("user_id"));
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }

    public static void updateBattleStatus(int battleId, String status) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("UPDATE battles SET status = ? WHERE id = ?")) {
            stmt.setString(1, status);
            stmt.setInt(2, battleId);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }
}