package com.upgrader.dao;

import com.upgrader.config.Database;
import com.upgrader.models.InventoryItem;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class InventoryDao {
    public static List<InventoryItem> getInventory(int userId) {
        List<InventoryItem> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE user_id = ?")) {
            stmt.setInt(1, userId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                InventoryItem ii = new InventoryItem();
                ii.id = rs.getInt("id");
                ii.userId = rs.getInt("user_id");
                ii.itemId = rs.getInt("item_id");
                ii.upgradeLevel = rs.getInt("upgrade_level");
                ii.equipped = rs.getBoolean("is_equipped");
                list.add(ii);
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }

    public static InventoryItem getInventoryItemById(int invId) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE id = ?")) {
            stmt.setInt(1, invId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                InventoryItem ii = new InventoryItem();
                ii.id = rs.getInt("id");
                ii.userId = rs.getInt("user_id");
                ii.itemId = rs.getInt("item_id");
                ii.upgradeLevel = rs.getInt("upgrade_level");
                ii.equipped = rs.getBoolean("is_equipped");
                return ii;
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return null;
    }

    public static void addItem(int userId, int itemId, int level) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement(
                     "INSERT INTO inventory (user_id, item_id, upgrade_level, is_equipped) VALUES (?, ?, ?, 0)")) {
            stmt.setInt(1, userId);
            stmt.setInt(2, itemId);
            stmt.setInt(3, level);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static void deleteItem(int invId) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("DELETE FROM inventory WHERE id = ?")) {
            stmt.setInt(1, invId);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static void updateEquipped(int invId, boolean equipped) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("UPDATE inventory SET is_equipped = ? WHERE id = ?")) {
            stmt.setBoolean(1, equipped);
            stmt.setInt(2, invId);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static void upgradeLevel(int invId) {
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("UPDATE inventory SET upgrade_level = upgrade_level + 1 WHERE id = ?")) {
            stmt.setInt(1, invId);
            stmt.executeUpdate();
        } catch (SQLException e) { e.printStackTrace(); }
    }

    public static List<InventoryItem> getEquippedItems(int userId) {
        List<InventoryItem> list = new ArrayList<>();
        try (Connection conn = Database.getConnection();
             PreparedStatement stmt = conn.prepareStatement("SELECT * FROM inventory WHERE user_id = ? AND is_equipped = 1")) {
            stmt.setInt(1, userId);
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                InventoryItem ii = new InventoryItem();
                ii.id = rs.getInt("id");
                ii.userId = rs.getInt("user_id");
                ii.itemId = rs.getInt("item_id");
                ii.upgradeLevel = rs.getInt("upgrade_level");
                ii.equipped = true;
                list.add(ii);
            }
        } catch (SQLException e) { e.printStackTrace(); }
        return list;
    }
}