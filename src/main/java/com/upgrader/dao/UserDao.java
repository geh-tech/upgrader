package com.upgrader.dao;

import com.upgrader.config.Database;
import com.upgrader.models.User;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class UserDao {
    public static boolean register(User user) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO users (nickname, password, level, coins, exp, max_hp, current_hp) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
            stmt.setString(1, user.nickname);
            stmt.setString(2, user.password);
            stmt.setInt(3, user.level);
            stmt.setInt(4, user.coins);
            stmt.setInt(5, user.exp);
            stmt.setInt(6, user.maxHp);
            stmt.setInt(7, user.currentHp);
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static User login(String nickname, String password) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE nickname = ? AND password = ?")) {
            stmt.setString(1, nickname);
            stmt.setString(2, password);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                User user = new User();
                user.id = rs.getInt("id");
                user.nickname = rs.getString("nickname");
                user.password = rs.getString("password");
                user.level = rs.getInt("level");
                user.coins = rs.getInt("coins");
                user.exp = rs.getInt("exp");
                user.maxHp = rs.getInt("max_hp");
                user.currentHp = rs.getInt("current_hp");
                return user;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static User getUserById(int id) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users WHERE id = ?")) {
            stmt.setInt(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                User user = new User();
                user.id = rs.getInt("id");
                user.nickname = rs.getString("nickname");
                user.password = rs.getString("password");
                user.level = rs.getInt("level");
                user.coins = rs.getInt("coins");
                user.exp = rs.getInt("exp");
                user.maxHp = rs.getInt("max_hp");
                user.currentHp = rs.getInt("current_hp");
                return user;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static void updateUser(User user) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "UPDATE users SET level=?, coins=?, exp=?, max_hp=?, current_hp=? WHERE id=?")) {
            stmt.setInt(1, user.level);
            stmt.setInt(2, user.coins);
            stmt.setInt(3, user.exp);
            stmt.setInt(4, user.maxHp);
            stmt.setInt(5, user.currentHp);
            stmt.setInt(6, user.id);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static List<User> getTopPlayers(int limit) {
        List<User> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM users ORDER BY level DESC, exp DESC LIMIT ?")) {
            stmt.setInt(1, limit);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                User user = new User();
                user.id = rs.getInt("id");
                user.nickname = rs.getString("nickname");
                user.level = rs.getInt("level");
                user.coins = rs.getInt("coins");
                user.exp = rs.getInt("exp");
                user.maxHp = rs.getInt("max_hp");
                user.currentHp = rs.getInt("current_hp");
                list.add(user);
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }
}