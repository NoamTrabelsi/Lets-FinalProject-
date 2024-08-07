// components/UserNavigation/UserNav.js
import React, { useContext, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import ChatWithUser from "../../screens/ChatWithUser";
import {
  Octicons,
  Ionicons,
  MaterialCommunityIcons,
  SimpleLineIcons,
} from "@expo/vector-icons";
import HomeScreen from "../../screens/HomeScreen";
import ProfilePage from "../../screens/ProfilePage";
import Chats from "../../screens/Chat";
import Settings from "../../screens/Settings";
import { UserContext } from "../UserContext/UserContext";
import { useSocket } from "../UserContext/SocketContext";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const Tab = createBottomTabNavigator();
const ChatStack = createStackNavigator();

function ChatsStackScreen() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatsList" component={Chats} />
      <ChatStack.Screen name="ChatWithUser" component={ChatWithUser} />
      <ChatStack.Screen name="ProfilePage" component={ProfilePage} />
    </ChatStack.Navigator>
  );
}

function ChatIconWithBadge({ color, size }) {
  const { newMessage } = useSocket();

  return (
    <View style={{ width: 24, height: 24, margin: 5 }}>
      <Ionicons name="chatbubble-outline" size={size} color={color} />
      {newMessage && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>new</Text>
        </View>
      )}
    </View>
  );
}

function UserNav() {
  const { user, fetchUserData } = useContext(UserContext);
  const { socket, setNewMessage, resetNewMessage } = useSocket();

  async function getData() {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      axios
        .post(`https://${process.env.EXPO_PUBLIC_HOST}/user`, { token })
        .then((res) => {
          if (res.data.status === "ok") {
            fetchUserData(res.data.data._id);
          } else {
            console.log("Error fetching user:", res.data.data);
          }
        })
        .catch((err) => console.log(err));
    }
  }

  useEffect(() => {
    getData();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleReceiveMessage = (data) => {
        if (data.senderId !== user._id) {
          setNewMessage(true);
          console.log(`Received message from ${data.senderId} (UserNav)`);
        }
      };

      socket.on("receiveMessage", handleReceiveMessage);

      return () => {
        socket.off("receiveMessage", handleReceiveMessage);
      };
    }
  }, [socket, user, setNewMessage]);

  return (
    <Tab.Navigator
      initialRouteName="HomeScreen"
      screenOptions={{ headerShown: false, tabBarActiveTintColor: "black" }}
    >
      <Tab.Screen
        name="Search"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Octicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsStackScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <ChatIconWithBadge color={color} size={size} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            resetNewMessage();
          },
        })}
      />
      <Tab.Screen
        name="ProfilePage"
        component={ProfilePage}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{
          tabBarIcon: ({ color, size }) => (
            <SimpleLineIcons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -6,
    top: -3,
    backgroundColor: "#FF8C00",
    borderRadius: 6,
    width: 25,
    height: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
});

export default UserNav;
