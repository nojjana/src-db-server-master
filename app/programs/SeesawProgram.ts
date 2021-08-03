import { Program, ProgramName } from "./Program";
import { SaftlimacherBaseProgram } from "./SaftlimacherBaseProgram";
import { LobbyController } from "../LobbyController";
import { Socket } from "socket.io";
import Matter, { Bodies, Render } from "matter-js";
import { SrcSocket } from "../SrcSocket";
import { group, timeStamp } from "console";
import { platform } from "os";


export class SeesawProgram extends SaftlimacherBaseProgram implements Program {

  // world
  private gravityX: number = 0;
  private gravityY: number = 0.6;

  // ingredients
  private availableIngredientTypes = 4; // TODO 4 beatle testen!
  // private ingredientRadius = 50;
  private ingredientRadius = 40;
  private ingredientLeft0?: Matter.Body;
  //private ingredientLeft1?: Matter.Body;
  //private ingredientLeft2?: Matter.Body;
  private ingredientRight0?: Matter.Body;
  //private ingredientRight1?: Matter.Body;
  //private ingredientRight2?: Matter.Body;

  // seesaw 1 (left)
  private seesaw1?: Matter.Body;
  private seesawBeam1?: Matter.Body;
  private seesaw1TriggerSpaceLeft?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private seesaw1TriggerSpaceRight?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  
  // seesaw 2 (right)
  private seesaw2?: Matter.Body;
  private seesawBeam2?: Matter.Body;
  private seesaw2TriggerSpaceLeft?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  private seesaw2TriggerSpaceRight?: Matter.Body; //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
  
  // container
  private shakerContainer?: Matter.Body;
  private garbageContainerLeft?: Matter.Body;
  private garbageContainerRight?: Matter.Body;
  private shakerContainerRadius = 70; //6 
  
  // placement of seesaws
  // TODO: 3 teile berrechnen und speichern
  private xSeesawLeftPosition = 1050; //900
  private xSeesawRightPosition = 1950; //1800
  private ySeesawPosition = 600; //1000
  private ySeesawBeamPosition = 640; //1040
  private seesaw1Angle = 0;
  private seesaw2Angle = 0;

  // dimension of seesaws
  private seesawLength = 500;
  private seesawHeight = 40;
  private seesawBeamLenght = 20;
  private seesawBeamHeight = 100;


  //placment of containers
  private xGarbageContainerLeft = 600;
  private xShakerContainer = 1500; //800
  private xGarbageContainerRight = 2350; //2400
  private yShakerContainer = 930;
  private yGarbageContainer = 1000;

  // placement of ingredients
  private xIngredientLeftPosition = 1050;   //860 - 200
  private xIngredientRightPosition = 1950;   //1760 - 200

  //seesawLeft: 900 / right: 1800
  //left field: 860-200 bis 1340-200   //right: 1760-200 bis 2240-200
  // ingredients placement: 50 for radius -> f.e. 950 or 1850
  // on browser side: angepasst auf -240

  private Constraint = Matter.Constraint;
  private Vector = Matter.Vector;
  private Composite = Matter.Composite;
//  private LeftLandedOnSeesaw = false;  //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw
//  private RightLandedOnSeesaw = false;  //used to trigger if ingredient is on seesaw to set "landedOnSeesaw" to true so that the Y axis is set to the current position of the seesaw

  constructor(lobbyController: LobbyController) {
    super(lobbyController);
  }

  /* -------------------- SEESAW GAME LOOP --------------------*/

  initGameLoop(fps: number) {
    this.gameLoop = setInterval(() => {
      if (this.engine == null || this.seesaw1 == null || this.seesaw2 == null) return;
      this.engine.world.gravity.x = this.gravityX;
      this.engine.world.gravity.y = this.gravityY;
      Matter.Engine.update(this.engine, 1000 / fps);   

      ////sending data to browser


    //  console.log("SERVER -> BROWSER - 1 pos X: "+this.seesaw1.position.x+" pos y: "+this.seesaw1.position.y+" angle: "+this.seesaw1.angle);
      this.lobbyController.sendToDisplays('seesaw1Position', [this.seesaw1.position.x, this.seesaw1.position.y, this.seesawLength, this.seesawHeight, this.seesaw1.angle]);
      //console.log("SERVER -> BROWSER - 2 pos X: "+this.seesaw2.position.x+" pos y: "+this.seesaw2.position.y+" angle: "+this.seesaw2.angle);
      this.lobbyController.sendToDisplays('seesaw2Position', [this.seesaw2.position.x, this.seesaw2.position.y, this.seesawLength, this.seesawHeight, this.seesaw2.angle]);
      //console.log("SERVER -> BROWSER - BEAM: pos X: "+this.seesawBeam1?.position.x+" pos y: "+this.seesawBeam1?.position.y+" axes "+this.seesawBeam1?.axes);
      this.lobbyController.sendToDisplays('seesawBeam1Position', [this.seesawBeam1?.position.x, this.seesawBeam1?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      //console.log("SERVER -> BROWSER - BEAM: pos X: "+this.seesawBeam1?.position.x+" pos y: "+this.seesawBeam1?.position.y+" axes "+this.seesawBeam1?.axes);
      this.lobbyController.sendToDisplays('seesawBeam2Position', [this.seesawBeam2?.position.x, this.seesawBeam2?.position.y, this.seesawBeamLenght, this.seesawBeamHeight]);
      
      this.lobbyController.sendToDisplays('seesaw1TriggerSpaceLeft', [this.seesaw1TriggerSpaceLeft?.position.x, this.seesaw1TriggerSpaceLeft?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw1TriggerSpaceRight', [this.seesaw1TriggerSpaceRight?.position.x, this.seesaw1TriggerSpaceRight?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw2TriggerSpaceLeft', [this.seesaw2TriggerSpaceLeft?.position.x, this.seesaw2TriggerSpaceLeft?.position.y, 40, 400]);
      this.lobbyController.sendToDisplays('seesaw2TriggerSpaceRight', [this.seesaw2TriggerSpaceRight?.position.x, this.seesaw2TriggerSpaceRight?.position.y, 40, 400]);
 
      this.lobbyController.sendToDisplays('updateScore', this.score);

      if (this.ingredientLeft0 != null) {
        // Matter.Body.setPosition(this.ingredientLeft0, {x: this.ingredientLeft0.position.x, y: this.ingredientLeft0.position.y});   //no inpact so far
        // Matter.Body.setAngle(this.ingredientLeft0, this.ingredientLeft0.angle);    //no inpact so far
        this.lobbyController.sendToDisplays('updateIngredientLeft0', [this.ingredientLeft0.position.x, this.ingredientLeft0.position.y, this.ingredientLeft0.angle]);
      //  console.log("SERVER -> BROWSER IngredientLeft X AFTER sending : "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y);
      }

/*       if (this.ingredientLeft1 != null) {
        //  console.log("IngredientLeft X before sending: "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y)
          this.lobbyController.sendToDisplays('updateIngredientLeft1', [this.ingredientLeft1.position.x, this.ingredientLeft1.position.y, this.ingredientLeft1.angle]);
      }

      if (this.ingredientLeft2 != null) {
        //  console.log("IngredientLeft X before sending: "+this.ingredientLeft.position.x+" and Y"+ this.ingredientLeft.position.y)
          this.lobbyController.sendToDisplays('updateIngredientLeft2', [this.ingredientLeft2.position.x, this.ingredientLeft2.position.y, this.ingredientLeft2.angle]);
      } */

      if (this.ingredientRight0 != null) {
          this.lobbyController.sendToDisplays('updateIngredientRight0', [this.ingredientRight0.position.x, this.ingredientRight0.position.y, this.ingredientRight0.angle]);
      }  

/*       if (this.ingredientRight1 != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight1', [this.ingredientRight1.position.x, this.ingredientRight1.position.y, this.ingredientRight1.angle]);
      } 

      if (this.ingredientRight2 != null) {
        this.lobbyController.sendToDisplays('updateIngredientRight2', [this.ingredientRight2.position.x, this.ingredientRight2.position.y, this.ingredientRight2.angle]);
      }  */      
/* 
      if (this.ingredientLeft0 != null && this.LeftLandedOnSeesaw == true) {
        let g = this.calcOppositeCathetus(this.xSeesawLeftPosition, this.ingredientLeft0.position.x);
        this.lobbyController.sendToDisplays('updateIngredientLeft0', [this.ingredientLeft0.position.x, (this.ingredientLeft0.position.y+this.ingredientRadius+g), this.ingredientLeft0.angle]);
        console.log("ingredientLeftPositionY: "+this.ingredientLeft0.position.y);
        console.log("ingredientLeft on seesaw// ingredientLeftPositionX: "+this.ingredientLeft0.position.x+" and new Y: "+ (this.ingredientLeft0.position.y+this.ingredientRadius+g))
      } 
      
      if (this.ingredientRight0 != null && this.RightLandedOnSeesaw == true) {
        let g = this.calcOppositeCathetus(this.xSeesawRightPosition, this.ingredientRight0.position.x);
        this.lobbyController.sendToDisplays('updateIngredientRight0', [this.ingredientRight0.position.x, (this.ingredientRight0.position.y+this.ingredientRadius+g), this.ingredientRight0.angle]);
        console.log("ingredientLeftPositionY: "+this.ingredientRight0.position.y);
        console.log("ingredientLeft on seesaw// ingredientLeftPositionX: "+this.ingredientRight0.position.x+" and new Y: "+ (this.ingredientRight0.position.y+this.ingredientRadius+g))
      } */
    }, 1000 / fps);
  }

  /* -------------------- SEESAW GAME METHODS --------------------*/

  initLevelData(): void {
    this.initSeesaws();
    this.initShakerContainer();
    this.initIngredients();
  }

  private initSeesaws(): void {
    if (this.engine == null) return;

    //seesaw1
    this.seesaw1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawPosition,
      this.seesawLength,  
      this.seesawHeight,
      {
        label: 'Seesaw1',
        isSensor: false,
        isStatic: true,
        density: 1.0,
        friction: 0.0, 
        restitution: 1.0,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1);
     
   
    this.seesawBeam1 = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam1',
        isSensor: false,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesawBeam1);
    
    //seesaw trigger space on the left side 
    this.seesaw1TriggerSpaceLeft = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition-320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw1TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1TriggerSpaceLeft);

    //seesaw trigger space on the left side 
    this.seesaw1TriggerSpaceRight = Matter.Bodies.rectangle(
      this.xSeesawLeftPosition+320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw1TriggerSpace',
        isSensor: true,
        isStatic: true,
      }
    )
    Matter.World.add(this.engine.world, this.seesaw1TriggerSpaceRight); 

 
    //seesaw2
  this.seesaw2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawPosition,
      this.seesawLength,
      this.seesawHeight,
      {
        label: 'Seesaw2',
        isSensor: false,
        isStatic: true,
        density: 1.0,
        friction: 0.0, 
        restitution: 1.0,  
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2);

      
    this.seesawBeam2 = Matter.Bodies.rectangle(
      this.xSeesawRightPosition,
      this.ySeesawBeamPosition,
      this.seesawBeamLenght,
      this.seesawBeamHeight,
      {
        label: 'SeesawBeam2',
        isSensor: false,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesawBeam2);  


    //seesaw trigger space on the left side 
    this.seesaw2TriggerSpaceLeft = Matter.Bodies.rectangle(
      this.xSeesawRightPosition-320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw2TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2TriggerSpaceLeft);

    //seesaw trigger space on the left side 
    this.seesaw2TriggerSpaceRight = Matter.Bodies.rectangle(
      this.xSeesawRightPosition+320,
      this.ySeesawPosition-300,
      40,
      400,
      {
        label: 'Seesaw2TriggerSpace',
        isSensor: true,
        isStatic: true
      }
    )
    Matter.World.add(this.engine.world, this.seesaw2TriggerSpaceRight);
  }  

  private initShakerContainer(): void {
    if (this.engine == null) return;

    this.shakerContainer = Matter.Bodies.circle(
      this.xShakerContainer,
      this.yShakerContainer,
      this.shakerContainerRadius,
      {
        label: 'Container',
        isSensor: true,
        isStatic: true,
      });
    Matter.World.add(this.engine.world, this.shakerContainer);

    this.garbageContainerLeft = Matter.Bodies.circle(
      this.xGarbageContainerLeft,
      this.yGarbageContainer,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerLeft);

    this.garbageContainerRight = Matter.Bodies.circle(
      this.xGarbageContainerRight,
      this.yGarbageContainer,
      this.shakerContainerRadius,
      {
        label: 'Garbage',
        isSensor: true,
        isStatic: true
      });
    Matter.World.add(this.engine.world, this.garbageContainerRight);
  }
  

  initIngredients(): void {
    if (this.engine == null) return;

    this.ingredientLeft0 = Matter.Bodies.circle(
      this.xIngredientLeftPosition,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientLeft0',
        isSensor: false,
        density: 0.1,
        friction: 0.0, 
        restitution: 0.05,
      });  
    Matter.World.add(this.engine.world, this.ingredientLeft0);

 

    this.ingredientRight0 = Matter.Bodies.circle(
      this.xIngredientRightPosition,
      -50,
      this.ingredientRadius,
      {
        label: 'IngredientRight0',
        isSensor: false,
        density: 0.1,
        friction: 0.0, 
        restitution: 0.05,
      });  
    Matter.World.add(this.engine.world, this.ingredientRight0);

  } 

  // private setUpGame() {
  //   this.engine = Matter.Engine.create();
  //   this.createWorldBounds();
  //   this.initSeesaws();
  //   this.initShakerContainer();
  //   this.initIngredients();
  //   this.initMatterEventCollision();
  //   this.sendLevelInfoToDisplay();
  // }

  //TODO: instaed of seesaw add a the mixer container and a bucket
  initMatterEventCollision() {
    // Matter.Events.on(this.engine, 'collisionActive', (event) => {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      const pairs = event.pairs;

      let i = 0, j = pairs.length;
      for (; i != j; ++i) {
        const pair = pairs[i];
          
        // Container - Ingredient catched
        if (pair.bodyA.label.includes('Container') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Container') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient catched
          let containerBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            containerBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }
          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          // TODO
          let seesawNr: number = parseInt(containerBody.label.charAt(containerBody.label.length - 1));

          if (this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
          //  console.log('catched a good ingredient, +50 points!!');
            this.score += this.scoreInc;
            // this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
          //  console.log('catched a wrong ingredient, NOT on list!!! -50 points.');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }
          //TODO new!
          let isLeft = ingredientBody.label.includes('Left');
          this.respawnIngredient(ingredientBody, isLeft);
        }

        // Garbage - Ingredient catched
        if (pair.bodyA.label.includes('Garbage') && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label.includes('Garbage') && pair.bodyA.label.includes('Ingredient')) {
          // ingredient catched
          let containerBody = pair.bodyA;
          let ingredientBody = pair.bodyB;
          if (pair.bodyA.label.includes('Ingredient')) {
            containerBody = pair.bodyB;
            ingredientBody = pair.bodyA;
          }


          let ingredientTypeNr: number = parseInt(ingredientBody.label.charAt(ingredientBody.label.length - 1));
          // TODO
          let seesawNr: number = parseInt(containerBody.label.charAt(containerBody.label.length - 1));

          if (!this.allIngredientNumbersOnList.includes(ingredientTypeNr)) {
            // good catch
          //  console.log('thrown away a bad ingredient!! +50 points.  ');
            this.score += this.scoreInc;
            // this.lobbyController.sendToControllers('vibrate', [seesawNr]);
            // this.lobbyController.sendToDisplays('checkIngredientOnList', ingredientTypeNr);
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          } else {
            // bad catch
          //  console.log('thrown away a good ingredient,, NOT on list!S -50 points!!');
            this.score -= this.scoreInc;
            this.lobbyController.sendToDisplays('adjustScoreByCatchedIngredient',
              [-this.scoreInc, ingredientTypeNr, ingredientBody.position.x, ingredientBody.position.y]);
          }

          //TODO new!
          let isLeft = ingredientBody.label.includes('Left');
          this.respawnIngredient(ingredientBody, isLeft);
        }

        if (pair.bodyA.label === 'Floor' && pair.bodyB.label.includes('Ingredient') || pair.bodyB.label === 'Floor' && pair.bodyB.label.includes('Ingredient')) {
          // ingredient touched the floor -> respawn
        //  console.log("ingredient touched floor");
          if (pair.bodyB.label.includes('Ingredient')) {
            this.respawnIngredient(pair.bodyB, pair.bodyB.label.includes('Left'));
          } else {
            this.respawnIngredient(pair.bodyA, pair.bodyA.label.includes('Left'));
          }
        }
      }
    });
  }

  // receiving data from ionic (controller)
  setControllerDataPlayer1(controllerData: number[]): void {
    this.seesaw1Angle = controllerData[0];
    let controllerId = controllerData[1];
    let seesaw1OldAngle = 0;
  //  console.log("IONIC -> SERVER: this.seesaw1Angle (controller Data) / controllerId:", seesaw1Angle, controllerId);
    
    if (this.seesaw1Angle != null && controllerId != null && this.seesaw1 != undefined) {
      if (controllerId != 1) return;
      Matter.Body.setAngle(this.seesaw1, this.seesaw1Angle);
    //  console.log("---- seesaw1.angle update called")
    //  if (this.seesaw1Angle == 0){
    //    Matter.Body.setPosition(this.seesaw1, {x: this.xSeesawLeftPosition, y: this.ySeesawPosition})
    //    console.log("seesaw1OldAngle MINUS "+-seesaw1OldAngle);
    //    Matter.Body.rotate(this.seesaw1, -seesaw1OldAngle);
    //    console.log("AFTER ROTATION seesaw1.angle: "+this.seesaw1.angle, " controller Data: "+seesaw1Angle)
    //    this.seesaw1.angle = this.seesaw1Angle;
    //    console.log("AFTER ASSIGNING SEESAW1ANGLE: seesaw2.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
    //    seesaw1OldAngle = this.seesaw1Angle;
    //  }  else {
    //    console.log("seesaw1.angle: "+this.seesaw1.angle)
    //    Matter.Body.setAngularVelocity(this.seesaw1, this.seesaw1.angle);
    //    Matter.Body.rotate(this.seesaw1, this.seesaw1.angle);
    //    console.log("AFTER ROTATION: seesaw1.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
    //    this.seesaw1.angle = this.seesaw1Angle;
    //    console.log("AFTER ASSIGNING SEESAW1ANGLE: seesaw2.angle: "+this.seesaw1.angle+" controller Data: "+seesaw1Angle)
    //    seesaw1OldAngle = this.seesaw1Angle;
    //    console.log("seesaw1OldAngle= "+seesaw1OldAngle);
    //  } 
    }
  }

  setControllerDataPlayer2(controllerData: number[]): void {
    // console.log("IONIC -> SERVER (seesaw2): controller Data: "+controllerData[0])
    this.seesaw2Angle = controllerData[0];
    let controllerId = controllerData[1];
    let seesaw2OldAngle = 0;

    if (this.seesaw2Angle != null && controllerId != null && this.seesaw2 != undefined) {
      if (controllerId != 2) return;
      Matter.Body.setAngle(this.seesaw2, this.seesaw2Angle);

      //  console.log("seesaw2.angle update called")
      //  this.seesaw2.angle = seesaw2Angle;  // zuweisen des angles an matter.js element im server
      /*    if (seesaw2Angle == 0){
          //console.log("------------ seesaw 0 called")
          Matter.Body.setPosition(this.seesaw2, {x: this.xSeesawRightPosition, y: this.ySeesawPosition})
          //console.log("seesaw2OldAngle MINUS "+-seesaw2OldAngle);
          Matter.Body.rotate(this.seesaw2, -seesaw2OldAngle);
          //console.log("AFTER ROTATION seesaw2.angle: "+this.seesaw2.angle, " controller Data: "+seesaw2Angle)
          this.seesaw2.angle = seesaw2Angle;
          //console.log("AFTER ASSIGNING SEESAW2ANGLE: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          seesaw2OldAngle = seesaw2Angle;
        }  else {
          //console.log("seesaw2.angle: "+this.seesaw2.angle)
          Matter.Body.setAngularVelocity(this.seesaw2, this.seesaw2.angle);
          Matter.Body.rotate(this.seesaw2, this.seesaw2.angle);
          //console.log("AFTER ROTATION: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          this.seesaw2.angle = seesaw2Angle;
          //console.log("AFTER ASSIGNING SEESAW2ANGLE: seesaw2.angle: "+this.seesaw2.angle+" controller Data: "+seesaw2Angle)
          seesaw2OldAngle = seesaw2Angle;
          //console.log("seesaw2OldAngle= "+seesaw2OldAngle);
        }  */
    }
  }

  // generateIngredientListNumbers() {
  //   let lastRandomInt = -1;
  //   for (let index = 0; index < 2; index++) {
  //     let currentRandomInt = this.getRandomInt(3);
  //     while (lastRandomInt == currentRandomInt) {
  //       currentRandomInt = this.getRandomInt(3);
  //     }
  //     this.allIngredientNumbersOnList.push(currentRandomInt);
  //     lastRandomInt = currentRandomInt;
  //   }
  //   this.allIngredientNumbersOnList.forEach(n => {
  //     console.log("number on list: " + n);
  //   });
  //   return this.allIngredientNumbersOnList;
  // }

  //TODO: respawn image at the same place again
  private respawnIngredient(body: Matter.Body, isLeft: Boolean) {
  ////  console.log("respawnIngredient: ");
    let newNumber = this.getRandomInt(this.availableIngredientTypes);
    let newlabel = '';
    if (isLeft) {
      newlabel = "IngredientLeft"+newNumber;
    } else {
      newlabel = "IngredientRight"+newNumber;
    }

    //TODO !!

    body.label = newlabel;
    Matter.Body.setStatic(body, true);
    Matter.Body.setStatic(body, false);
    // Matter.Body.setPosition(body, {
    //   x: body.position.x,
    //   y: -500
    // });
    

   if (isLeft) {
    Matter.Body.setPosition(body, {
      x: this.xIngredientLeftPosition,
      y: -200
    });
    this.lobbyController.sendToDisplays('changeImageIngredientLeft0', [newNumber]);
   } else {
    Matter.Body.setPosition(body, {
      x: this.xIngredientRightPosition,
      y: -200
    });
    this.lobbyController.sendToDisplays('changeImageIngredientRight0', [newNumber]);
   }


    // Stimmt nie!!
    // switch (body.position.x) {
    //   case this.xIngredientLeftPosition:
    //     Matter.Body.setPosition(body, {
    //       x: this.xIngredientLeftPosition,
    //       y: -500
    //     });
    //     this.lobbyController.sendToDisplays('changeImageIngredientLeft0', [newNumber]);
    //     break;
    //   case this.xIngredientRightPosition:
    //     Matter.Body.setPosition(body, {
    //       x: this.xIngredientRightPosition,
    //       y: -500
    //     });
    //     this.lobbyController.sendToDisplays('changeImageIngredientRight0', [newNumber]);
    //     break;  
    //   default:
    //     break;
    // }
//   console.log("body.label =", body.label);
  }

  /* private calcOppositeCathetus(xSeesawPosition: any, xIngredientPosition: any){
    let a = xIngredientPosition - xSeesawPosition; //Ankathete
    console.log("--xSeesawPosition: " +xSeesawPosition + " xIngredientPosition: "+xIngredientPosition);
    console.log("--seesawAngle: "+this.seesaw1Angle);
    let angle;
    if (this.seesaw1Angle < 0){
      angle = this.seesaw1Angle*-9;
     }else{
      angle = this.seesaw1Angle*9;
     }
    let g = Math.tan(angle*Math.PI/180) * a;  //Gegenkathete = (Tangenz von angle in radians(bogenmass)) * Ankathete
    console.log("--Ankathete: "+a+" Angle: "+angle+" Gegenkathete: "+g);
    return g  //yPosition von Ingredient + Länge Gegenkathete 
  } */

  
  collectLevelData() {
    let data: any[] = [];

    // 0 -> list
    data.push(this.allIngredientNumbersOnList);
    // 1 2 -> seesaw1
    data.push(this.seesaw1?.position.x);
    data.push(this.seesaw1?.position.y);
    // 3 4 -> seesaw2
    data.push(this.seesaw2?.position.x);
    data.push(this.seesaw2?.position.y);
    // 5 6 7 8 -> ingredients
    data.push(this.ingredientLeft0?.position.x);
    data.push(this.ingredientLeft0?.position.y);
    data.push(this.ingredientRight0?.position.x);
    data.push(this.ingredientRight0?.position.y);

    return data;
  }

  createWorldBounds(): void {

    // TODO use method in base class!! and adapt.

    if (this.engine == null) return;

    Matter.World.add(this.engine.world, [
      // Top
      // Matter.Bodies.rectangle(this.width / 2, 0, this.width, 10, {
      //   isStatic: true
      // }),
      // Left
      Matter.Bodies.rectangle(0, this.height / 2, 10, this.height, {
        isStatic: true,
        render: { 
          visible: true, 
        }
      }),
      // Bottom
      // not visible, further down. trigger for respawning fruit
      Matter.Bodies.rectangle(this.width / 2, this.height+400, this.width, 10, {
        label: 'Floor',
        isStatic: true,
        isSensor: true,
        render: { 
          visible: true, }
      }),
      // Right
      Matter.Bodies.rectangle(this.width, this.height / 2, 10, this.height, {
        isStatic: true,
        render: { 
          visible: true, }
      })
    ])
  }


  clearInGameTimers() {

  }

}