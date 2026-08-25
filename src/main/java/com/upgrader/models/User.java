package com.upgrader.models;

public class InventoryItem {
    private int id;           // id записи в инвентаре
    private int userId;
    private int itemId;
    private int upgradeLevel;
    private boolean equipped;
    // дополнительно можно хранить Item объект для удобства
}