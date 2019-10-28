# UK and IE Address Autocomplete

Simple demo to search for addresses via the Postcoder API on keypress.

Full documentation available here: https://postcoder.com/docs/address-lookup#address-autocomplete

## Get started

To get your free trial API key visit https://postcoder.com/sign-up

To get the demo working, find "PCW45-12345-12345-1234X" in `js-example.html` and replace with your own key, including the quote marks.

Then open the file and begin searching.

## Basic Usage

```
<link rel="stylesheet" href="css/postcoder-autocomplete.css">
    //Alternative style sheets commented out

<div class="address-finder" id="address_finder">
    <div class="form-group">
        <label for="postcoder_autocomplete" id="postcoder_autocomplete_label">Enter postcode or address</label>
        <input id="postcoder_autocomplete" type="text" class="form-control">
    </div>
</div>  

<script src="js/postcoder-autocomplete.js"></script>
<script>
    var autocomplete_wrapper = document.getElementById("address_finder");
    var autocomplete_input = document.getElementById("postcoder_autocomplete");
    var autocomplete_label = document.getElementById("postcoder_autocomplete_label");

    // Attach autocomplete to search box and country selector with our settings
    // To get your free trial API key visit https://www.alliescomputing.com/postcoder/sign-up
    var postcoder_complete = new AlliesComplete(autocomplete_input, {
        apiKey: "PCW45-12345-12345-1234X",  // Replace with your own key
        autocompleteLabel: autocomplete_label,
        autocompleteWrapper: autocomplete_wrapper
    });

    // This event is fired by library when user selects an item in the list
    autocomplete_input.addEventListener("postcoder-complete-selectcomplete", function(e) {

      // Do something with the selected address here
      // Address fields found in the 'e.address' object

      // Clear the search field
      autocomplete_input.value = "";
      // Remove focus from the search field
      autocomplete_input.blur();

    });
</script>
```
