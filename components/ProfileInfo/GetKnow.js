import React, { useState, useContext } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
  Modal,
  Image,
  ActivityIndicator,
} from "react-native";
import countryList from "react-select-country-list";
import { UserContext } from "../UserContext/UserContext";
import * as ImagePicker from "expo-image-picker";
import AWS from "aws-sdk";
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "@env";
import { Ionicons } from "@expo/vector-icons";
import { Entypo } from "@expo/vector-icons";
import { SimpleLineIcons } from "@expo/vector-icons";

// Load required polyfill
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

function GetKnow({ location, setLocation, age, setAge, picture, setPicture }) {
  const { user, updateUser } = useContext(UserContext);
  const [filteredCountries, setFilteredCountries] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false); // Loading state for image upload
  const countries = countryList().getData();

  const s3 = new AWS.S3({
    region: process.env.EXPO_PUBLIC_AWS_REGION,
    accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY,
  });

  const handleCountryChange = (countryName) => {
    setLocation(countryName);
    setFilteredCountries([]);
    setIsModalVisible(false);
    Keyboard.dismiss();
  };

  const findCountry = (query) => {
    if (query === "") {
      setFilteredCountries([]);
      return;
    }
    const regex = new RegExp(`^${query.trim()}`, "i");
    const filtered = countries.filter(
      (country) => country.label.search(regex) >= 0
    );
    setFilteredCountries(filtered);
  };

  const handleQueryChange = (query) => {
    setLocation(query);
    findCountry(query);
  };

  const selectPhoto = async () => {
    try {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        const { uri } = result.assets[0];
        const fileName = uuidv4() + ".jpg";

        const response = await fetch(uri);
        const blob = await response.blob();

        const params = {
          Bucket: "lets-project",
          Key: fileName,
          Body: blob,
          ContentType: "image/jpeg",
          ACL: "public-read", // public access to the image
        };

        setLoading(true); // Set loading state to true
        s3.upload(params, async (err, data) => {
          setLoading(false); // Set loading state to false
          if (err) {
            console.error("Error uploading image:", err);
          } else {
            const imageUrl = data.Location;
            console.log("Image uploaded successfully:", imageUrl);
            setPicture(imageUrl);
            updateUser("image", imageUrl); // Update user image
          }
        });
      }
    } catch (error) {
      setLoading(false); // Set loading state to false in case of an error
      console.log(error);
    }
  };

  const selectAge = (textAge) => {
    const age = parseInt(textAge);
    setAge(age);
    updateUser("age", age); // Update user age
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <Text style={styles.text}>Get to know you</Text>
        <View style={styles.view1}>
          <View style={styles.imageContainer}>
            <TouchableOpacity style={styles.roundButton} disabled={true}>
              {loading ? (
                <ActivityIndicator size="large" color="#FF8C00" />
              ) : picture ? (
                <Image source={{ uri: picture }} style={styles.image} />
              ) : (
                <Text style={styles.buttonText}>Add picture</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={selectPhoto}>
              <Ionicons name="add-circle-sharp" size={40} color="white" />
            </TouchableOpacity>
          </View>
          <View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 20,
              }}
            >
              <Entypo name="location" size={20} color="black" />
              <TouchableOpacity
                style={styles.locationBtn}
                onPress={() => setIsModalVisible(true)}
              >
                <Text style={styles.buttonText}>
                  {location || "Current Location"}
                </Text>
              </TouchableOpacity>
            </View>
            <Modal
              visible={isModalVisible}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setIsModalVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <TextInput
                    style={styles.locationInput}
                    placeholder="Type country name"
                    placeholderTextColor="gray"
                    onChangeText={handleQueryChange}
                  />
                  {filteredCountries.length > 0 && (
                    <FlatList
                      data={filteredCountries}
                      keyExtractor={(item) => item.value}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.item}
                          onPress={() => handleCountryChange(item.label)}
                        >
                          <Text style={styles.itemText}>{item.label}</Text>
                        </TouchableOpacity>
                      )}
                      style={styles.list}
                    />
                  )}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setIsModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: 20,
              }}
            >
              <SimpleLineIcons name="present" size={20} color="black" />
              <TextInput
                placeholder={age ? age.toString() : "Age"}
                placeholderTextColor="black"
                style={styles.ageBtn}
                keyboardType="numeric"
                maxLength={2}
                caretHidden={true}
                onChangeText={(text) => selectAge(text)}
              />
            </View>
          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  text: {
    marginTop: 36,
    fontSize: 24,
    padding: 12,
    fontWeight: "bold",
  },
  view1: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  imageContainer: {
    position: "relative",
    width: 130,
    height: 130,
  },
  roundButton: {
    width: "100%",
    height: "100%",
    borderRadius: 75, // Half the height of the button - stable for creating a circle
    backgroundColor: "white", // Button background color
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    position: "absolute",
    right: -5,
    bottom: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF8C00",
    justifyContent: "center",
    alignItems: "center",
  },
  locationBtn: {
    margin: 12,
    width: 150,
    height: 35,
    backgroundColor: "white",
    borderRadius: 20, // Can be adjusted to create rounded corners
    justifyContent: "center",
    alignItems: "center",
  },
  ageBtn: {
    margin: 12,
    width: 150,
    height: 35,
    backgroundColor: "white",
    borderRadius: 20, // Can be adjusted to create rounded corners
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    fontSize: 12,
    color: "black",
    fontWeight: "bold",
  },
  buttonText: {
    color: "black",
    fontSize: 12,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-start", // Align modal at the top
    alignItems: "center",
    paddingTop: 50, // Add padding at the top for spacing
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 10,
  },
  locationInput: {
    width: 250,
    height: 40,
    borderColor: "gray",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  list: {
    maxHeight: 200,
    alignSelf: "stretch", // Make the list take full width
  },
  item: {
    padding: 8,
    borderBottomColor: "gray",
  },
  itemText: {
    fontSize: 16,
    textAlign: "left", // Align text to the left
  },
  closeButton: {
    backgroundColor: "#FF8C00",
    padding: 10,
    borderRadius: 10,
    marginTop: 20,
    alignItems: "center",
    width: "40%",
    justifyContent: "center",
    alignSelf: "center",
  },
  closeButtonText: {
    fontSize: 16,
    color: "white",
    fontWeight: "bold",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 75,
  },
});

export default GetKnow;
